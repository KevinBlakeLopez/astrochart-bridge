import createSwissEphModule from '../wasm/swisseph.mjs';
import { ASCMC, Body, Calendar, EclipseFlag, EclipticNutationId, Flag, HouseSystem, RiseTransit, SIGNS, } from './constants.js';
import { requiredEphemerisFiles } from './ephemeris/files.js';
import { determineSect, } from './derived/sect.js';
import { calculateLots, } from './derived/lots.js';
import { ANGLE_EVENTS, findParans, } from './derived/parans.js';
import { lunarEclipseKind, optionalTime, solarEclipseKind, } from './derived/eclipses.js';
import { atmosphereToArray, observerToArray, } from './derived/heliacal.js';
import { SwissEphError, } from './types.js';
const DEFAULT_EPHE_PATH = '/ephe';
/**
 * Anything the WebAssembly module prints, sent somewhere that is never a data
 * channel.
 *
 * Under Node this is `process.stderr`; in a browser there is no such thing, so
 * it falls back to `console.error`. The check is on the object rather than on
 * a `typeof window` guess, because the bundlers that ship this to a browser
 * also shim `process` — partially.
 */
function writeDiagnostic(text) {
    const stderr = globalThis
        .process?.stderr;
    if (typeof stderr?.write === 'function')
        stderr.write(`${text}\n`);
    else
        console.error(text);
}
/** char serr[AS_MAXCH] — sweodef.h:259. */
const ERROR_BUFFER_SIZE = 256;
/**
 * swe_houses_ex2 cusps dizisi normalde 13 double ister (1-tabanlı, 12 ev),
 * ancak Gauquelin sektörleri (hsys 'G') 37 istiyor. Her zaman büyük olanı
 * ayırıyoruz — 200 bayt için ev sistemi başına dallanmaya değmez, ve eksik
 * ayırmak sessiz bellek taşması demek olurdu.
 */
const CUSPS_BUFFER_SIZE = 37;
/**
 * Gauquelin sektör sayısı. `swehouse.c` içinde dört ayrı yerde `ito = 36`
 * ve başlık yorumu `cusp[37]` diyor.
 *
 * Tampon baştan beri doğru boyuttaydı; YANLIŞ OLAN OKUMAYDI. Sabit 13 double
 * okumak 'G' için 36 sektörün 12'sini döndürüyordu ve dönen 12 değer gerçek
 * olduğu için hiçbir şey bozuk görünmüyordu — kullanıcı 36 sektörlük bir
 * analizi 12 sektörle yapıyordu. Kırpılma belgelere de geçmişti.
 */
const GAUQUELIN_SECTOR_COUNT = 36;
/** Diğer bütün ev sistemleri 12 ev döndürür. */
const HOUSE_COUNT = 12;
/**
 * ascmc / ascmc_speed tamponlarının double cinsinden boyutu.
 *
 * `ASCMC.Count` (= SE_NASCMC = 8) DİZİNİN BOYUTU DEĞİL, anlamlı alanların
 * sayısı. C tarafı 10 double yazıyor: `swehouse.c:681` ve `:694` sekizden
 * ona kadar olan gözleri sıfırlıyor, `:267` ise Sunshine ('I') sistemi için
 * Güneş'in deklinasyonunu ascmc[9]'a koyuyor.
 *
 * ASCMC.Count kadar ayırmak her houses() çağrısında 16 baytlık bir taşma
 * demekti. ÖLÇÜLDÜ: dlmalloc bu boyutta 72 baytlık chunk veriyor, dolayısıyla
 * taşan iki double komşu ayırmanın malloc başlığını sıfırlıyor ve ilk
 * baytlarına yazıyordu — bufAscmc bufAscmcSpeed'i, bufAscmcSpeed de
 * bufGeo'yu (gözlemcinin boylamı) eziyordu. Dönen açı değerleri doğru
 * göründüğü için hiçbir şey yanlış görünmüyordu; bozulan yığın metaverisiydi
 * ve bedeli dispose() içindeki free()'ye erteleniyordu.
 */
const ASCMC_BUFFER_SIZE = 10;
/**
 * Bu ev sistemi Gauquelin sektörleri mi?
 *
 * C tarafı `toupper(hsys) == 'G'` ile bakıyor (swehouse.c:225), yani `'g'` de
 * 36 sektör yazar. Aynısını yapıyoruz: burada büyük/küçük harf ayrımı
 * gözetmek, C'nin yazdığından AZ okumak demek olurdu. ('I'/'i' Sunshine
 * varyantlarında harf durumu anlamlı, ama 'G' için değil.)
 */
const isGauquelin = (system) => system.charAt(0).toUpperCase() === 'G';
/** swe_azalt: ekliptik koordinattan ufuk koordinatına. swephexp.h:364 */
const SE_ECL2HOR = 0;
/** swe_rise_trans: cisim ufku hiç kesmiyor (kutup altı ya da hep yukarıda). */
const RISE_TRANS_NO_EVENT = -2;
/**
 * tret[10] ve attr[20]. swecl.c'deki belge blokları "declare as attr[20] at
 * least" diyor — daha küçük ayırmak sessiz yığın taşması olurdu.
 */
const ECLIPSE_TIMES_SIZE = 10;
const ECLIPSE_ATTR_SIZE = 20;
/** swe_heliacal_ut dret[]. Belgelenen 3 alan var, tampon cömert tutuldu. */
const HELIACAL_BUFFER_SIZE = 50;
/**
 * Bir cismin aynı boylama YAKLAŞIK dönüş süresi, gün.
 *
 * Sonucu belirlemiyor — yalnızca genel amaçlı kesişim aramasının adım
 * boyunu ve varsayılan arama sınırını ölçekliyor. Yine de test ediliyor:
 * her cisim için dönüş bu sürenin içinde bulunabiliyor mu diye bakılıyor,
 * yoksa elle yazılmış sayılar sessizce çürür.
 */
const MEAN_RETURN_DAYS = {
    [Body.Sun]: 365.2422, // tropik yıl
    [Body.Moon]: 27.32158, // tropik ay
    [Body.Mercury]: 87.969,
    [Body.Venus]: 224.701,
    [Body.Mars]: 686.980,
    [Body.Jupiter]: 4332.589,
    [Body.Saturn]: 10759.22,
    [Body.Uranus]: 30685.4,
    [Body.Neptune]: 60189,
    [Body.Pluto]: 90560,
};
/** Kesişim aramasında adım başına kat edilen ORTALAMA hareket, derece. */
const CROSSING_STEP_DEGREES = 2;
const CROSSING_MIN_STEP_DAYS = 0.005;
const CROSSING_MAX_STEP_DAYS = 30;
/** İkiye bölme durma eşiği: 1e-7 gün ≈ 9 milisaniye. */
const CROSSING_PRECISION_DAYS = 1e-7;
/** Hiçbir tablo girdisi yoksa aramanın üst sınırı, gün (≈200 yıl). */
const CROSSING_MAX_SEARCH_DAYS = 73000;
/** (-180, 180] aralığına indirgenmiş açı farkı. */
const signedDegrees = (degrees) => {
    const n = ((degrees % 360) + 360) % 360;
    return n > 180 ? n - 360 : n;
};
const EPHEMERIS_FLAG = {
    swiss: Flag.SwissEphemeris,
    moshier: Flag.Moshier,
    jpl: Flag.JplEphemeris,
};
/** SE'nin eksik dosya mesajı. Dosya adını yakalıyoruz. */
const MISSING_FILE = /SwissEph file '([^']+)' not found/;
/**
 * Hangi npm paketi bu `.se1` dosyasını taşıyor?
 *
 * Kullanıcının bilmesi gereken şey bu; SE'nin söylediği şey ise sanal bir
 * arama yolu.
 */
function packageProviding(file) {
    if (/^se(pl|mo|as)m?\d*_?\d*\.se1$/.test(file) || file.endsWith('.txt')) {
        return '@kuntay/swisseph-data';
    }
    // Numaralı asteroidler: se00433s.se1, s136199s.se1 gibi.
    if (/^s\d/.test(file) || /^se\d/.test(file))
        return '@kuntay/swisseph-asteroids';
    return null;
}
/**
 * Eksik efemeris dosyası hatasını eyleme dönük hâle getirir.
 *
 * SE'nin kendi metni şöyle:
 *
 *   SwissEph file 'seas_18.se1' not found in PATH '.:/users/ephe2/:/users/ephe/'
 *
 * O PATH **emscripten sanal dosya sistemindeki** bir yol; kullanıcının
 * makinesinde yok. Yani mesaj, okuyanı doğrudan yanlış yere bakmaya
 * yönlendiriyor: yapması gereken şey diskte bir dizin aramak değil,
 * mountEphemeris() / mountEphemerisDirectory() çağırmak.
 *
 * Ham `serr` kaybolmuyor, `detail` alanında duruyor.
 */
function ephemerisError(serr, fn) {
    const file = serr ? MISSING_FILE.exec(serr)?.[1] : undefined;
    if (!serr || !file) {
        return new SwissEphError(serr ?? `${fn} failed`, fn);
    }
    const pkg = packageProviding(file);
    return new SwissEphError(`Ephemeris file '${file}' is not loaded. ` +
        (pkg ? `It ships in ${pkg}. ` : '') +
        'Load it with mountEphemeris({ ' + `'${file}'` + ': bytes }) or, under ' +
        'Node, mountEphemerisDirectory(dir). (The path in the underlying message ' +
        'is inside the WebAssembly filesystem, not on your disk.) Planets fall ' +
        'back to Moshier automatically; asteroids and fixed stars cannot, which ' +
        'is why this raised instead of degrading.', fn, serr);
}
/** Dönen iflag'den hangi efemerisin GERÇEKTEN kullanıldığını okur. */
function ephemerisFromFlags(returnedFlags) {
    if (returnedFlags & Flag.Moshier)
        return 'moshier';
    if (returnedFlags & Flag.JplEphemeris)
        return 'jpl';
    return 'swiss';
}
/**
 * Creates an isolated Swiss Ephemeris instance.
 *
 * Every call gets its **own** WebAssembly instance, and therefore its own
 * linear memory. That is a correctness requirement rather than a
 * convenience: Swiss Ephemeris keeps all of its state in a single global
 * `swed` struct, so `swe_set_topo`, `swe_set_sid_mode` and
 * `swe_set_ephe_path` are process-wide on the C side. On a server sharing one
 * instance, the sidereal mode set by one request silently changes the answer
 * given to the next.
 *
 * Use one instance per request in concurrent code, or queue work through a
 * single instance. Creating one is not free — it compiles WebAssembly — so
 * pooling is the sensible middle ground.
 */
/*
 * ÖLÇÜLDÜ — aynı ölçümü tekrar yapmayın.
 *
 * Kurulum bir çağrıyı gerçekten domine ediyor: örnek başına 3,97 ms, buna
 * karşılık 11 cisim için calc() 0,506 ms (46 µs/cisim) ve houses() 20,7 µs.
 * MCP tarzı tam bir çağrının (örnek + 11 cisim + evler) 7,7 ms'sinin ~%87'si
 * kurulum.
 *
 * Doğal refleks "WASM modülünü bir kez derle, paylaş" oluyor. Denendi:
 *
 *   şu anki hâl (createSwissEphModule)        3,68 ms
 *   wasmBinary önbellekli (dosya okuma yok)   3,51 ms   %5
 *   paylaşılan WebAssembly.Module             3,26 ms   %11
 *
 * Maliyet DERLEMEDE değil (V8 aynı byte'ları zaten önbelleğe alıyor),
 * ÖRNEKLEMEDE: lineer bellek ayırma, tablo/global kurulumu, swed struct init,
 * FS kurulumu. %11 için instantiateWasm karmaşıklığı alınmaz.
 *
 * Gerçek kaldıraç örnek HAVUZLAMA olurdu — ama havuzlama swed durumunu
 * (set_topo, set_sid_mode, set_ephe_path) kullanımlar arasında SIFIRLAMAYI
 * gerektirir, ki bu tam olarak yukarıdaki izolasyon tasarımının kaçındığı
 * doğruluk riski. Yani havuzlama ancak bir reset() metoduyla birlikte anlamlı,
 * ve o metot ölçülmüş bir ihtiyaç olmadan yazılmamalı.
 *
 * 7,7 ms bir LLM'e cevap veren MCP sunucusu için önemsiz. Optimize edilecek
 * bir sorun yok.
 */
export async function createSwissEph(options = {}) {
    /*
     * WASM'in stdout'u stderr'e yönlendiriliyor.
     *
     * Emscripten glue'sunun ürettiği hâli `var out=console.log.bind(console)` —
     * yani modülün stdout'a yazdığı her şey SÜRECİN stdout'una gidiyor. Bu
     * kütüphanenin en büyük kullanıcısı bir MCP sunucusu ve orada stdout
     * protokolün kendisi: araya düşecek tek bir satır JSON-RPC akışını bozar,
     * istemci sunucuyu düşürür ve ortada hiçbir hata mesajı olmaz.
     *
     * Derlenen C dosyalarındaki printf çağrılarının tamamı bugün ölü kod
     * (`if ((0))`, `#if 0`) — yani şu anda akan bir şey yok. Ölçüm bu; koruma
     * ise gelecek için: abort yolları, FS uyarıları ve yukarı akıştan gelecek
     * yeni bir printf, hepsi sessizce protokolü bozabilecek durumda. Yönlendirme
     * bedava, ve stdout'a düşmesi gereken tek bir satır yok.
     */
    const wasm = await createSwissEphModule({
        print: writeDiagnostic,
        printErr: writeDiagnostic,
    });
    // Tamponlar bir kez ayrılıp tekrar kullanılıyor: çağrı başına malloc/free
    // yok. Örnek tek iş parçacığında sıralı kullanıldığı için güvenli.
    const bufPosition = wasm._malloc(6 * 8);
    const bufError = wasm._malloc(ERROR_BUFFER_SIZE);
    const bufName = wasm._malloc(ERROR_BUFFER_SIZE);
    const bufCusps = wasm._malloc(CUSPS_BUFFER_SIZE * 8);
    const bufCuspSpeed = wasm._malloc(CUSPS_BUFFER_SIZE * 8);
    const bufAscmc = wasm._malloc(ASCMC_BUFFER_SIZE * 8);
    const bufAscmcSpeed = wasm._malloc(ASCMC_BUFFER_SIZE * 8);
    const bufGeo = wasm._malloc(3 * 8); // gözlemci: boylam, enlem, yükseklik
    const bufHorIn = wasm._malloc(3 * 8); // swe_azalt girdisi
    const bufHorOut = wasm._malloc(3 * 8); // azimut, gerçek yük., görünen yük.
    const bufTret = wasm._malloc(ECLIPSE_TIMES_SIZE * 8);
    const bufAttr = wasm._malloc(ECLIPSE_ATTR_SIZE * 8);
    const bufDatm = wasm._malloc(4 * 8); // basınç, sıcaklık, nem, görüş
    const bufDobs = wasm._malloc(6 * 8); // gözlemci parametreleri
    const bufDret = wasm._malloc(HELIACAL_BUFFER_SIZE * 8);
    /*
     * Yıldız adı için AYRI tampon.
     *
     * swe_rise_trans ve swe_heliacal_ut aldıkları adı swe_fixstar'a
     * geçiriyor (swecl.c:894) ve swe_fixstar adı çözüp GERİ YAZIYOR. cwrap'in
     * 'string' dönüştürücüsü argümanı yığına (stack) koyuyor; çözülen ad
     * girilenden uzun olduğunda oraya yazmak yığını taşırırdı.
     */
    const bufObjectName = wasm._malloc(ERROR_BUFFER_SIZE);
    let disposed = false;
    const c = {
        calcUt: wasm.cwrap('swe_calc_ut', 'number', ['number', 'number', 'number', 'number', 'number']),
        julday: wasm.cwrap('swe_julday', 'number', ['number', 'number', 'number', 'number', 'number']),
        revjul: wasm.cwrap('swe_revjul', null, ['number', 'number', 'number', 'number', 'number', 'number']),
        deltatEx: wasm.cwrap('swe_deltat_ex', 'number', ['number', 'number', 'number']),
        housesEx2: wasm.cwrap('swe_houses_ex2', 'number', ['number', 'number', 'number', 'number', 'number',
            'number', 'number', 'number', 'number', 'number']),
        fixstar2: wasm.cwrap('swe_fixstar2', 'number', ['number', 'number', 'number', 'number', 'number']),
        getPlanetName: wasm.cwrap('swe_get_planet_name', 'string', ['number', 'number']),
        setEphePath: wasm.cwrap('swe_set_ephe_path', null, ['string']),
        setSidMode: wasm.cwrap('swe_set_sid_mode', null, ['number', 'number', 'number']),
        setTopo: wasm.cwrap('swe_set_topo', null, ['number', 'number', 'number']),
        getAyanamsaExUt: wasm.cwrap('swe_get_ayanamsa_ex_ut', 'number', ['number', 'number', 'number', 'number']),
        azalt: wasm.cwrap('swe_azalt', null, ['number', 'number', 'number', 'number', 'number', 'number', 'number']),
        riseTrans: wasm.cwrap('swe_rise_trans', 'number', ['number', 'number', 'number', 'number', 'number',
            'number', 'number', 'number', 'number', 'number']),
        solcrossUt: wasm.cwrap('swe_solcross_ut', 'number', ['number', 'number', 'number', 'number']),
        mooncrossUt: wasm.cwrap('swe_mooncross_ut', 'number', ['number', 'number', 'number', 'number']),
        solEclipseWhenGlob: wasm.cwrap('swe_sol_eclipse_when_glob', 'number', ['number', 'number', 'number', 'number', 'number', 'number']),
        solEclipseWhenLoc: wasm.cwrap('swe_sol_eclipse_when_loc', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number']),
        lunEclipseWhen: wasm.cwrap('swe_lun_eclipse_when', 'number', ['number', 'number', 'number', 'number', 'number', 'number']),
        lunEclipseWhenLoc: wasm.cwrap('swe_lun_eclipse_when_loc', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number']),
        heliacalUt: wasm.cwrap('swe_heliacal_ut', 'number', ['number', 'number', 'number', 'number', 'number',
            'number', 'number', 'number', 'number']),
        version: wasm.cwrap('swe_version', 'string', ['number']),
        close: wasm.cwrap('swe_close', null, []),
    };
    const readDoubles = (ptr, n) => Array.from({ length: n }, (_, i) => wasm.getValue(ptr + i * 8, 'double'));
    const readError = () => {
        const s = wasm.UTF8ToString(bufError);
        return s && s.length ? s : null;
    };
    const writeDoubles = (ptr, values) => {
        values.forEach((v, i) => wasm.setValue(ptr + i * 8, v, 'double'));
    };
    /** Tamponu sıfırlar: SE yazmadığı gözü OLDUĞU GİBİ bırakıyor, dolayısıyla
     *  "bu evre gerçekleşmedi" ancak sıfırdan ayırt edilebiliyor. */
    const zeroDoubles = (ptr, n) => {
        for (let i = 0; i < n; i++)
            wasm.setValue(ptr + i * 8, 0, 'double');
    };
    const writeGeo = (place) => {
        writeDoubles(bufGeo, [place.longitude, place.latitude, place.altitude ?? 0]);
    };
    const assertLive = () => {
        if (disposed) {
            throw new SwissEphError('This instance has been disposed.', 'createSwissEph');
        }
    };
    /** Dosyaları sanal dosya sistemine yazar ve arama yolunu ayarlar. */
    function mountFiles(files, dir = DEFAULT_EPHE_PATH) {
        try {
            wasm.FS.mkdir(dir);
        }
        catch {
            // Zaten var — birden çok kez mount etmek geçerli bir kullanım.
        }
        let bytes = 0;
        for (const [name, content] of Object.entries(files)) {
            const data = content instanceof Uint8Array ? content : new Uint8Array(content);
            wasm.FS.writeFile(`${dir}/${name}`, data);
            bytes += data.byteLength;
        }
        c.setEphePath(dir);
        return bytes;
    }
    /**
     * Dönüş hesabının ortak gövdesi.
     *
     * api'ye başvurduğu için fonksiyon bildirimi olarak yazıldı — api henüz
     * tanımlanmadan önce burada duruyor, çağrıldığında hazır oluyor.
     */
    function returnOf(body, natalJd, options = {}) {
        const after = options.after ?? natalJd;
        const natalLongitude = api.calc(natalJd, body, options).longitude;
        if (!options.precessionCorrected) {
            return {
                jd: api.nextCrossing(body, natalLongitude, after, options),
                targetLongitude: natalLongitude,
                natalLongitude,
                precessionCorrected: false,
            };
        }
        /*
         * Presesyon düzeltmeli dönüş, cismin aynı SİDEREAL boylama dönüşü.
         * Tropikal hedef, aradan geçen sürede biriken presesyon kadar kayıyor:
         *
         *   hedef = natal + (ayanamsa(dönüş) - ayanamsa(natal))
         *
         * Hedef cevaba bağlı olduğu için yineliyoruz. Ayanamsa farkı alındığı
         * için hangi ayanamsanın seçili olduğu önemsiz: sabit kayma sadeleşiyor,
         * geriye presesyon hızı kalıyor.
         *
         * İki tur yetiyor — 30 yılda düzeltme yaklaşık bir gün, o bir günde
         * ayanamsa 0.14 saniyelik yay değişiyor.
         */
        const natalAyanamsa = api.ayanamsa(natalJd, options.ephemeris);
        let target = natalLongitude;
        let jd = after;
        for (let i = 0; i < 3; i++) {
            jd = api.nextCrossing(body, target, after, options);
            const refined = natalLongitude
                + (api.ayanamsa(jd, options.ephemeris) - natalAyanamsa);
            const converged = Math.abs(refined - target) < 1e-9;
            target = refined;
            if (converged)
                break;
        }
        return {
            jd: api.nextCrossing(body, target, after, options),
            targetLongitude: target,
            natalLongitude,
            precessionCorrected: true,
        };
    }
    // --- kuruluş ------------------------------------------------------------
    if (options.files)
        mountFiles(options.files, options.ephemerisPath);
    else if (options.ephemerisPath)
        c.setEphePath(options.ephemerisPath);
    const api = {
        /** The vendored Swiss Ephemeris version, e.g. `"2.10.03"`. */
        get version() {
            assertLive();
            return c.version(bufName);
        },
        /** Direct access to the Emscripten module. An escape hatch; prefer the API. */
        get raw() {
            return wasm;
        },
        // --- tarih ------------------------------------------------------------
        /**
         * Calendar date to Julian day. The hour is read as Universal Time.
         * @param hour decimal hour, e.g. 14.5 = 14:30
         */
        julianDay(year, month, day, hour = 0, calendar = Calendar.Gregorian) {
            assertLive();
            return c.julday(year, month, day, hour, calendar);
        },
        /** Julian day back to a calendar date. The inverse of `julianDay()`. */
        calendarDate(jd, calendar = Calendar.Gregorian) {
            assertLive();
            // revjul int* çıktı parametreleri alıyor; double tamponunu 32-bit
            // gözlerine bölerek yeniden kullanıyoruz.
            const y = bufCusps, m = bufCusps + 4, d = bufCusps + 8, h = bufCusps + 16;
            c.revjul(jd, calendar, y, m, d, h);
            return {
                year: wasm.getValue(y, 'i32'),
                month: wasm.getValue(m, 'i32'),
                day: wasm.getValue(d, 'i32'),
                hour: wasm.getValue(h, 'double'),
            };
        },
        /** ΔT (TT − UT) in days. */
        deltaT(jd, ephemeris = 'swiss') {
            assertLive();
            return c.deltatEx(jd, EPHEMERIS_FLAG[ephemeris], bufError);
        },
        // --- konumlar ---------------------------------------------------------
        /**
         * A body's position, for a moment given in Universal Time.
         *
         * Check the `ephemeris` field on the result: when Swiss Ephemeris cannot
         * find the `.se1` file you asked for, it falls back to Moshier without
         * raising an error.
         */
        calc(jd, body, options = {}) {
            assertLive();
            const source = options.ephemeris ?? 'swiss';
            const flags = EPHEMERIS_FLAG[source] | Flag.Speed | (options.flags ?? 0);
            // serr'i temizle: SE yalnızca hata durumunda yazıyor, temizlemezsek
            // önceki çağrının uyarısını bu çağrıya ait sanardık.
            wasm.setValue(bufError, 0, 'i8');
            const ret = c.calcUt(jd, body, flags, bufPosition, bufError);
            const message = readError();
            if (ret < 0) {
                // Eksik dosyayı tanıyıp eyleme dönük mesajla sarıyoruz: SE'nin kendi
                // metni SANAL bir yolu gösteriyor ve okuyanı yanlış yere yönlendirir.
                throw ephemerisError(message, 'swe_calc_ut');
            }
            const [longitude, latitude, distance, longitudeSpeed, latitudeSpeed, distanceSpeed] = readDoubles(bufPosition, 6);
            return {
                longitude, latitude, distance,
                longitudeSpeed, latitudeSpeed, distanceSpeed,
                ephemeris: ephemerisFromFlags(ret),
                warning: message,
            };
        },
        /** `calc()` plus sign, degree-in-sign and retrograde state. */
        calcWithSign(jd, body, options = {}) {
            const p = api.calc(jd, body, options);
            // Boylam [0,360) garanti değil (Flag.Radians veya ekvatoral modda farklı);
            // burç türetmesi yalnızca ekliptik derece için anlamlı.
            const normalized = ((p.longitude % 360) + 360) % 360;
            const signIndex = Math.floor(normalized / 30);
            return {
                ...p,
                signIndex,
                sign: SIGNS[signIndex],
                degreeInSign: normalized - signIndex * 30,
                retrograde: p.longitudeSpeed < 0,
            };
        },
        /** The body's name, e.g. `Body.Chiron` gives `"Chiron"`. */
        planetName(body) {
            assertLive();
            return c.getPlanetName(body, bufName);
        },
        /**
         * A fixed star's position.
         * @param name traditional name (`"Aldebaran"`) or Bayer designation (`",alTau"`)
         */
        fixedStar(name, jd, options = {}) {
            assertLive();
            const source = options.ephemeris ?? 'swiss';
            const flags = EPHEMERIS_FLAG[source] | Flag.Speed | (options.flags ?? 0);
            // İlk parametre giriş VE çıkış: SE çözümlediği tam adı geri yazıyor.
            wasm.stringToUTF8(name, bufName, ERROR_BUFFER_SIZE);
            wasm.setValue(bufError, 0, 'i8');
            const ret = c.fixstar2(bufName, jd, flags, bufPosition, bufError);
            const message = readError();
            if (ret < 0) {
                // Yıldız katalogu (sefstars.txt) eksikse hata eksik DOSYA hatası,
                // "böyle bir yıldız yok" değil. İkisini ayırmak gerekiyor.
                if (message && MISSING_FILE.test(message)) {
                    throw ephemerisError(message, 'swe_fixstar2');
                }
                throw new SwissEphError(message ?? `Fixed star not found: ${name}`, 'swe_fixstar2');
            }
            const [longitude, latitude, distance, longitudeSpeed, latitudeSpeed, distanceSpeed] = readDoubles(bufPosition, 6);
            return {
                longitude, latitude, distance,
                longitudeSpeed, latitudeSpeed, distanceSpeed,
                ephemeris: ephemerisFromFlags(ret),
                warning: message,
                resolvedName: wasm.UTF8ToString(bufName),
            };
        },
        // --- evler ------------------------------------------------------------
        /**
         * House cusps and angles.
         *
         * Several house systems are undefined beyond the polar circle and Swiss
         * Ephemeris substitutes Porphyry there. That is reported as
         * `substituted` rather than thrown — see {@link Houses}.
         *
         * `cusps.length` is 12 for every system except `HouseSystem.GauquelinSectors`
         * (`'G'`), which gives 36 — do not assume twelve.
         *
         * @param latitude  geographic latitude, north positive
         * @param longitude geographic longitude, east positive
         */
        houses(jd, latitude, longitude, system = HouseSystem.Placidus, options = {}) {
            assertLive();
            const flags = options.flags ?? 0;
            wasm.setValue(bufError, 0, 'i8');
            const gauquelin = isGauquelin(system);
            /*
             * Tamponu sıfırlıyoruz: aşağıda -1'in "uyarı" mı "gerçek hata" mı
             * olduğunu, cusps'ın doldurulup doldurulmadığına bakarak ayırt
             * edeceğiz. Önceki çağrının verisi kalırsa bu ayrım bozulur.
             *
             * 'G' için C 36 sektör yazıyor, dolayısıyla 37 double'ın tamamını
             * sıfırlamak gerekiyor — yalnızca ilk 13'ü sıfırlamak sentinel'i
             * sektörlerin üçte birine daraltırdı.
             */
            const writeCount = gauquelin ? CUSPS_BUFFER_SIZE : HOUSE_COUNT + 1;
            for (let i = 0; i < writeCount; i++) {
                wasm.setValue(bufCusps + i * 8, 0, 'double');
            }
            const ret = c.housesEx2(jd, flags, latitude, longitude, system.charCodeAt(0), bufCusps, bufAscmc, bufCuspSpeed, bufAscmcSpeed, bufError);
            const message = readError();
            /*
             * Kaç cusp okunacağı sisteme VE sonuca bağlı.
             *
             * 'G' normalde 36 sektör yazıyor. Ama kutup dairesinin ötesinde CalcH
             * Porphyry'ye düşüyor ve swe_houses_armc_ex2 o durumda `ito`yu 12'ye
             * indiriyor (swehouse.c:665-668) — yani yalnızca 12 cusp yazılıyor.
             * Orada 36 okumak, 24 tanesi sıfır olan bir dizi döndürürdü: kırpmayı
             * düzeltirken yerine sahte veri koymak olurdu.
             *
             * ret < 0 tam olarak "ito 12'ye indirildi" demek, o yüzden koşul bu.
             */
            const cuspCount = gauquelin && ret >= 0 ? GAUQUELIN_SECTOR_COUNT : HOUSE_COUNT;
            // C dizisi 1-tabanlı: cusps[1] birinci ev. 0-tabanlıya çeviriyoruz.
            const raw = readDoubles(bufCusps, cuspCount + 1);
            const ascmc = readDoubles(bufAscmc, ASCMC.Count);
            const cusps = raw.slice(1, cuspCount + 1);
            /*
             * -1 BURADA HATA DEMEK DEĞİL.
             *
             * Placidus, Koch, Gauquelin ve Sunshine kutup dairesinin ötesinde
             * tanımsız. Swiss Ephemeris bu durumda Porphyry'ye geçip -1
             * döndürüyor (swehouse.c:1252) ama cusps'ı geçerli değerlerle
             * dolduruyor — yani bu bir uyarı. Altın korpustaki 3120 ev satırının
             * 153'ü (%4.9) bu durumda, hepsi aynı mesajla.
             *
             * Gerçek hata yolu da var (swehouse.c:658, Sunshine + geçersiz
             * deklinasyon) ve orada cusps DOLDURULMUYOR. İkisini, tamponu
             * sıfırlayıp doldurulmuş mu diye bakarak ayırıyoruz — mesaj metnine
             * bağlanmak upstream metin değişince sessizce kırılırdı.
             */
            const filled = cusps.some((cusp) => cusp !== 0);
            if (ret < 0 && !filled) {
                throw new SwissEphError(message ?? `Could not compute house system '${system}'`, 'swe_houses_ex2');
            }
            /*
             * Alçalan ve Dip Noktası'nı BURADA türetiyoruz.
             *
             * Swiss Ephemeris ikisini döndürmüyor, çünkü tanım gereği eksenin öbür
             * ucu. Çağıranın 7. ve 4. ev ucundan okuyacağı varsayılıyor — ama bu
             * varsayım yalnızca dörtlü (quadrant) sistemlerde geçerli. Whole sign'da
             * 4. ev ucu 0° Oğlak iken gerçek IC 1° Kova olabiliyor: 31° fark, ve
             * çıktının hiçbir yerinde gerçek IC'ye ulaşmanın yolu yok. Equal, Morinus,
             * Vehlow ve meridyen sistemlerinde de aynı durum.
             *
             * Yarım tur birimi bayrağa bağlı: Flag.Radians altında bütün açılar
             * radyan döndüğü için 180 eklemek sessizce anlamsız bir sayı üretirdi.
             */
            const halfTurn = flags & Flag.Radians ? Math.PI : 180;
            const opposite = (angle) => ((angle + halfTurn) % (halfTurn * 2) + halfTurn * 2) % (halfTurn * 2);
            return {
                cusps,
                requestedSystem: system,
                substituted: ret < 0,
                ascendant: ascmc[ASCMC.Ascendant],
                midheaven: ascmc[ASCMC.Midheaven],
                descendant: opposite(ascmc[ASCMC.Ascendant]),
                imumCoeli: opposite(ascmc[ASCMC.Midheaven]),
                armc: ascmc[ASCMC.Armc],
                vertex: ascmc[ASCMC.Vertex],
                equatorialAscendant: ascmc[ASCMC.EquatorialAscendant],
                coAscendantKoch: ascmc[ASCMC.CoAscendantKoch],
                coAscendantMunkasey: ascmc[ASCMC.CoAscendantMunkasey],
                polarAscendant: ascmc[ASCMC.PolarAscendant],
                warning: message,
            };
        },
        // --- türetilmiş hesaplar ----------------------------------------------
        /**
         * Sect, chart points and Arabic lots for a birth moment and place.
         *
         * Gathers the positions the lots need, determines the sect, and resolves
         * the lots in dependency order — several are defined in terms of others.
         *
         * ```ts
         * const { sect, lots } = swe.lots(jd, { latitude: 39.93, longitude: 32.86 });
         * lots.Fortune.degreeInSign;
         * ```
         */
        lots(jd, options) {
            assertLive();
            const { latitude, longitude, houseSystem = HouseSystem.Placidus } = options;
            /*
             * calcOptions EVLERE DE gidiyor.
             *
             * Gitmediğinde çerçeveler karışıyordu: calcOptions'ta Flag.Sidereal ile
             * çağrıldığında gezegenler sidereal, Yükselen ve Tepe Noktası tropikal
             * geliyordu. Her lot Yükselen'i içerdiği için sonuç bir ayanamsa kadar
             * (2026'da ~24°) kayıyor ve HİÇBİR uyarı çıkmıyordu — üstelik Şans ve
             * Ruh gibi ayanamsanın sadeleştiği lotlar doğru görünmeye devam ederek
             * hatayı iyice gizliyordu. Ölçüldü: sidereal istenen bir haritada
             * Fortune 0°34' Yengeç dedi, doğrusu 6°51' İkizler'di.
             */
            const houses = api.houses(jd, latitude, longitude, houseSystem, options.calcOptions);
            const at = (body) => api.calc(jd, body, options.calcOptions).longitude;
            const points = {
                ascendant: houses.ascendant,
                midheaven: houses.midheaven,
                sun: at(Body.Sun),
                moon: at(Body.Moon),
                mercury: at(Body.Mercury),
                venus: at(Body.Venus),
                mars: at(Body.Mars),
                jupiter: at(Body.Jupiter),
                saturn: at(Body.Saturn),
                northNode: at(Body.NorthNodeTrue),
            };
            // Sekt için gerçek yüksekliği kullanıyoruz: yükselen kısayolu kutup
            // dairesinin ötesinde bozuluyor ve buna bağlı bütün lotlar kayardı.
            //
            // Çağıran sekti elle geçse bile GERÇEĞİNİ hesaplıyoruz: hesap ucuz ve
            // sunElevation'ı NaN bırakmak, alanı okuyan kodu sessizce bozardı.
            // Geçersiz kılma ayrı bir alanla bildiriliyor.
            const detected = api.sect(jd, latitude, longitude, options.sectOptions);
            const sectResult = options.sect
                ? { ...detected, sect: options.sect, overridden: options.sect !== detected.sect }
                : { ...detected, overridden: false };
            return {
                sect: sectResult,
                points,
                lots: calculateLots(points, sectResult.sect, options.definitions),
            };
        },
        /**
         * A body's horizon coordinates.
         *
         * @returns `azimuth` measured from south towards west;
         *          `altitude`, the true (unrefracted) height;
         *          `apparentAltitude`, with atmospheric refraction applied
         */
        horizontal(jd, body, latitude, longitude, altitudeMetres = 0, options = {}) {
            assertLive();
            const position = api.calc(jd, body, options);
            wasm.setValue(bufGeo, longitude, 'double');
            wasm.setValue(bufGeo + 8, latitude, 'double');
            wasm.setValue(bufGeo + 16, altitudeMetres, 'double');
            wasm.setValue(bufHorIn, position.longitude, 'double');
            wasm.setValue(bufHorIn + 8, position.latitude, 'double');
            wasm.setValue(bufHorIn + 16, position.distance, 'double');
            c.azalt(jd, SE_ECL2HOR, bufGeo, 0, 0, bufHorIn, bufHorOut);
            const [azimuth, altitude, apparentAltitude] = readDoubles(bufHorOut, 3);
            return { azimuth, altitude, apparentAltitude };
        },
        /**
         * Whether the chart is diurnal or nocturnal.
         *
         * Most Arabic lots and much of traditional dignity depend on this; get it
         * wrong and the results are quietly wrong rather than obviously so.
         *
         * The default uses the Sun's **true altitude**. The traditional ascendant
         * shortcut (`method: 'ascendant'`) agrees exactly up to the polar circle
         * and then breaks down — at 70° latitude it can report "night" with the
         * Sun 11° above the horizon. See `derived/sect.ts`.
         *
         * The `borderline` field marks charts where the Sun is within a degree of
         * the horizon, so a minute of uncertainty in the birth time could flip
         * the answer.
         */
        sect(jd, latitude, longitude, options = {}) {
            assertLive();
            const sun = api.calc(jd, Body.Sun);
            // Yükselen yalnızca 'ascendant' yöntemi için gerekli; kutup bölgesinde
            // houses() ev sistemi değiştirebildiğinden gereksiz yere çağırmıyoruz.
            if (options.method === 'ascendant') {
                const houses = api.houses(jd, latitude, longitude, options.houseSystem ?? HouseSystem.Placidus);
                return determineSect(sun.longitude, houses.ascendant, options);
            }
            const { altitude } = api.horizontal(jd, Body.Sun, latitude, longitude);
            return determineSect(sun.longitude, 0, {
                ...options, method: 'altitude', sunAltitude: altitude,
            });
        },
        // --- deklinasyon ------------------------------------------------------
        /**
         * A body's position in equatorial coordinates.
         *
         * The same call as {@link calc} with `Flag.Equatorial`, but with the
         * fields named for what they hold. Under that flag Swiss Ephemeris
         * returns right ascension where longitude normally sits and declination
         * where latitude sits, which is easy to misread.
         */
        equatorial(jd, body, options = {}) {
            const p = api.calc(jd, body, {
                ...options, flags: (options.flags ?? 0) | Flag.Equatorial,
            });
            return {
                rightAscension: p.longitude,
                declination: p.latitude,
                distance: p.distance,
                rightAscensionSpeed: p.longitudeSpeed,
                declinationSpeed: p.latitudeSpeed,
                distanceSpeed: p.distanceSpeed,
                ephemeris: p.ephemeris,
                warning: p.warning,
            };
        },
        /**
         * Obliquity of the ecliptic and the nutation at a moment.
         *
         * Needed for out-of-bounds work: the limit a body has to pass is the
         * obliquity, which drifts by about 47 arcseconds per century. Using the
         * J2000 constant instead flips the verdict for any body sitting within
         * a tenth of a degree of the boundary.
         */
        obliquity(jd, options = {}) {
            assertLive();
            wasm.setValue(bufError, 0, 'i8');
            // SE_ECL_NUT bir cisim değil; swe_calc_ut onu özel kimlik olarak alıp
            // dört değeri konum tamponuna yazıyor.
            const flags = EPHEMERIS_FLAG[options.ephemeris ?? 'swiss'] | (options.flags ?? 0);
            const ret = c.calcUt(jd, EclipticNutationId, flags, bufPosition, bufError);
            if (ret < 0) {
                throw new SwissEphError(readError() ?? 'swe_calc_ut failed', 'swe_calc_ut');
            }
            const [trueObliquity, meanObliquity, nutationInLongitude, nutationInObliquity] = readDoubles(bufPosition, 4);
            return { trueObliquity, meanObliquity, nutationInLongitude, nutationInObliquity };
        },
        /**
         * Declinations for a set of bodies, ready for
         * `findDeclinationAspects()` and `outOfBounds()`.
         *
         * ```ts
         * const points = swe.declinations(jd, [Body.Sun, Body.Moon, Body.Venus]);
         * const parallels = findDeclinationAspects(points);
         * const oob = outOfBounds(points, swe.obliquity(jd).trueObliquity);
         * ```
         */
        declinations(jd, bodies, options = {}) {
            return bodies.map((body) => {
                const eq = api.equatorial(jd, body, options);
                return {
                    name: api.planetName(body),
                    body,
                    declination: eq.declination,
                    speed: eq.declinationSpeed,
                };
            });
        },
        // --- doğuş, batış, kültminasyon ---------------------------------------
        /**
         * When a body or star next reaches one of the four angles.
         *
         * @param target a body constant, or a fixed star name
         * @param event  one of `RiseTransit.Rise`, `.Set`, `.UpperCulmination`,
         *               `.LowerCulmination`, optionally OR'd with the
         *               `RiseTransit` modifier bits
         *
         * A circumpolar object never rises or sets. That is not an error, and it
         * is reported as `occurs: false` rather than thrown — a chart at 70° N
         * has bodies in exactly that state and should still compute.
         */
        riseTransit(jd, target, place, event = RiseTransit.Rise, options = {}) {
            assertLive();
            const isStar = typeof target === 'string';
            const flags = EPHEMERIS_FLAG[options.ephemeris ?? 'swiss'] | (options.flags ?? 0);
            if (isStar)
                wasm.stringToUTF8(target, bufObjectName, ERROR_BUFFER_SIZE);
            writeGeo(place);
            wasm.setValue(bufError, 0, 'i8');
            zeroDoubles(bufTret, 1);
            const ret = c.riseTrans(jd, isStar ? 0 : target, isStar ? bufObjectName : 0, flags, event, bufGeo, options.pressure ?? 0, options.temperature ?? 0, bufTret, bufError);
            if (ret === RISE_TRANS_NO_EVENT)
                return { jd: null, occurs: false };
            if (ret < 0) {
                throw new SwissEphError(readError() ?? 'swe_rise_trans failed', 'swe_rise_trans');
            }
            return { jd: wasm.getValue(bufTret, 'double'), occurs: true };
        },
        /**
         * All four angle times for each object, the input parans need.
         *
         * Each event is the *next* occurrence at or after `jd`, so the four times
         * span roughly one rotation. Objects that never cross the horizon are
         * marked `circumpolar` or `neverRises` and still report their
         * culminations, which is what makes a paran with a circumpolar star
         * possible at all.
         */
        angleEvents(jd, targets, place, options = {}) {
            assertLive();
            const bits = {
                rise: RiseTransit.Rise,
                set: RiseTransit.Set,
                culminate: RiseTransit.UpperCulmination,
                anticulminate: RiseTransit.LowerCulmination,
            };
            return targets.map((target) => {
                const isStar = typeof target === 'string';
                const events = {};
                for (const event of ANGLE_EVENTS) {
                    const r = api.riseTransit(jd, target, place, bits[event], options);
                    if (r.occurs && r.jd !== null)
                        events[event] = r.jd;
                }
                const entry = {
                    name: isStar ? target : api.planetName(target),
                    ...(isStar ? { star: target } : { body: target }),
                    events,
                };
                // Ne doğuş ne batış varsa cisim ya hep yukarıda ya hep aşağıda.
                // Hangisi olduğunu deklinasyondan okuyoruz: enlemin işaretiyle
                // çarpılmış deklinasyon 90-|enlem|'i aşıyorsa hiç batmıyor demektir.
                if (events.rise === undefined && events.set === undefined) {
                    const declination = isStar
                        ? api.fixedStar(target, jd, {
                            ...options, flags: (options.flags ?? 0) | Flag.Equatorial,
                        }).latitude
                        : api.equatorial(jd, target, options).declination;
                    const limit = 90 - Math.abs(place.latitude);
                    const signed = declination * Math.sign(place.latitude || 1);
                    if (signed > limit)
                        entry.circumpolar = true;
                    else if (signed < -limit)
                        entry.neverRises = true;
                }
                return entry;
            });
        },
        /**
         * Parans between a set of objects at a place.
         *
         * A convenience over {@link angleEvents} and `findParans()`; reach for
         * those two directly when you want to reuse the event times.
         *
         * ```ts
         * const contacts = swe.parans(jd, [Body.Sun, Body.Mars, 'Sirius'],
         *   { latitude: 39.93, longitude: 32.86 }, { orbMinutes: 20 });
         * ```
         */
        parans(jd, targets, place, options = {}) {
            return findParans(api.angleEvents(jd, targets, place, options), options);
        },
        // --- dönüşler ---------------------------------------------------------
        /**
         * The next time a body reaches a given longitude.
         *
         * The Sun and Moon use Swiss Ephemeris's own crossing routines. Everything
         * else is found by stepping and then bisecting.
         *
         * Two things to know about the general case. A planet near a station can
         * cross the same longitude three times, and this returns the **first**.
         * And a stepped search can in principle skip a pair of crossings that both
         * fall inside one step — possible only when a station sits within about
         * two degrees of the target.
         *
         * @param afterJd the search starts here and always moves forward; a
         *                crossing exactly at `afterJd` is skipped, so calling this
         *                repeatedly walks through successive crossings
         */
        nextCrossing(body, targetLongitude, afterJd, options = {}) {
            assertLive();
            const flags = EPHEMERIS_FLAG[options.ephemeris ?? 'swiss'] | (options.flags ?? 0);
            const period = MEAN_RETURN_DAYS[body];
            // Güneş ve Ay için SE'nin kendi rutinleri var; kendi aramamızı
            // kullanmak gereksiz ve daha az doğru olurdu. (Testler ikisini
            // birbirine karşı doğruluyor.)
            const dedicated = body === Body.Sun ? c.solcrossUt
                : body === Body.Moon ? c.mooncrossUt : null;
            if (dedicated && !options.forceSearch) {
                const fnName = body === Body.Sun ? 'swe_solcross_ut' : 'swe_mooncross_ut';
                wasm.setValue(bufError, 0, 'i8');
                let t = dedicated(targetLongitude, afterJd, flags, bufError);
                // Hata yolu jd_ut - 1 döndürüyor (sweph.c), yani geçmişe gitmek
                // hatanın ta kendisi.
                if (t < afterJd) {
                    throw new SwissEphError(readError() ?? `${fnName} failed`, fnName);
                }
                // Cisim başlangıç anında zaten hedefteyse SE aynı anı döndürüyor.
                // Bir dönüşü "doğum anının kendisi" diye raporlamamak için, dönüş
                // süresinin binde biri kadar ileriden tekrar arıyoruz — yakınsama
                // toleransının çok üstünde, periyodun yanında ihmal edilebilir.
                if (t <= afterJd + CROSSING_PRECISION_DAYS) {
                    t = dedicated(targetLongitude, afterJd + period / 1000, flags, bufError);
                    if (t < afterJd) {
                        throw new SwissEphError(readError() ?? `${fnName} failed`, fnName);
                    }
                }
                return t;
            }
            const calcOptions = { ...options, flags: options.flags };
            const at = (t) => api.calc(t, body, calcOptions);
            const delta = (t) => signedDegrees(at(t).longitude - targetLongitude);
            const start = at(afterJd);
            const meanSpeed = period
                ? 360 / period
                : Math.max(Math.abs(start.longitudeSpeed), 360 / CROSSING_MAX_SEARCH_DAYS);
            const maxDays = options.maxDays
                ?? Math.min(1.5 * (360 / meanSpeed), CROSSING_MAX_SEARCH_DAYS);
            // Adım ORTALAMA hızla ölçekleniyor, anlık hızla değil: durağan bir
            // gezegende anlık hız sıfıra gidiyor ve adım, retrograd ilmeğin
            // tamamını atlayacak kadar büyürdü.
            const step = Math.min(Math.max(CROSSING_STEP_DEGREES / meanSpeed, CROSSING_MIN_STEP_DAYS), CROSSING_MAX_STEP_DAYS);
            let lo = afterJd;
            let dLo = signedDegrees(start.longitude - targetLongitude);
            // Tam hedefteysek bir adım kenara çekiliyoruz, yoksa aramanın ilk
            // noktası kök sayılıp başlangıç anı "dönüş" olarak dönerdi.
            if (Math.abs(dLo) < 1e-9) {
                lo = afterJd + step;
                dLo = delta(lo);
            }
            while (lo - afterJd < maxDays) {
                const hi = lo + step;
                const dHi = delta(hi);
                // İşaret değişimi kök demek — ama 0/360 sarmasında da işaret
                // değişiyor. Gerçek kökte iki değer de küçük ve birbirine yakın;
                // sarmada aralarında ~360 derece var.
                if ((dLo < 0) !== (dHi < 0) && Math.abs(dLo - dHi) < 180) {
                    let a = lo, b = hi, dA = dLo;
                    while (b - a > CROSSING_PRECISION_DAYS) {
                        const mid = (a + b) / 2;
                        const dMid = delta(mid);
                        if (dMid === 0)
                            return mid;
                        if ((dA < 0) === (dMid < 0)) {
                            a = mid;
                            dA = dMid;
                        }
                        else {
                            b = mid;
                        }
                    }
                    return (a + b) / 2;
                }
                lo = hi;
                dLo = dHi;
            }
            throw new SwissEphError(`${api.planetName(body)} did not cross ` +
                `${targetLongitude.toFixed(4)}° within ${maxDays.toFixed(0)} days. ` +
                'Pass a larger maxDays to search further.', 'nextCrossing');
        },
        /**
         * Solar return: when the Sun comes back to its natal longitude.
         *
         * Set `precessionCorrected` to return to the same **sidereal** longitude
         * instead. The two disagree by the precession accumulated since birth —
         * roughly a day of Sun motion after thirty years — and which one is
         * correct is a live disagreement between practitioners, not a detail.
         *
         * The correction is measured with whatever sidereal mode the instance
         * currently has, since it is the *change* in ayanamsa that matters and
         * the constant offset cancels. Rates do differ slightly between models
         * though: about one arcsecond per year, which after thirty years moves
         * the corrected return by a quarter of an hour. Call `setSiderealMode()`
         * first if your tradition specifies one.
         *
         * ```ts
         * const { jd } = swe.solarReturn(natalJd, { after: swe.julianDay(2026, 1, 1) });
         * const chart = swe.houses(jd, 39.93, 32.86);
         * ```
         */
        solarReturn(natalJd, options = {}) {
            return returnOf(Body.Sun, natalJd, options);
        },
        /**
         * Lunar return: when the Moon comes back to its natal longitude.
         * Roughly every 27.3 days. `precessionCorrected` works as for the solar
         * return, though over one month the correction is negligible.
         */
        lunarReturn(natalJd, options = {}) {
            return returnOf(Body.Moon, natalJd, options);
        },
        /**
         * A return of any body to its natal longitude — Mars returns, Saturn
         * returns, and so on. Slow bodies need a wide search; see
         * {@link nextCrossing} for what `maxDays` does.
         */
        returnOf(body, natalJd, options = {}) {
            return returnOf(body, natalJd, options);
        },
        // --- tutulmalar -------------------------------------------------------
        /**
         * The next solar eclipse.
         *
         * With no `place`, the search is global — the next eclipse anywhere,
         * optionally filtered to a type. With a `place`, it is the next eclipse
         * *visible from there*, and the result carries magnitude, obscuration and
         * the Sun's altitude at maximum.
         *
         * The two searches also return different timings, which is why they are
         * mapped to named fields here: what the C API calls `tret[4]` is the
         * start of totality in one and the fourth contact in the other.
         */
        solarEclipse(afterJd, options = {}) {
            assertLive();
            const flags = EPHEMERIS_FLAG[options.ephemeris ?? 'swiss'] | (options.flags ?? 0);
            const backward = options.backward ? 1 : 0;
            if (options.place && options.type !== undefined) {
                throw new SwissEphError('swe_sol_eclipse_when_loc takes no type filter. Passing `type` ' +
                    'together with `place` would be silently ignored; filter the result ' +
                    'yourself, or drop `place` to search globally.', 'solarEclipse');
            }
            wasm.setValue(bufError, 0, 'i8');
            zeroDoubles(bufTret, ECLIPSE_TIMES_SIZE);
            zeroDoubles(bufAttr, ECLIPSE_ATTR_SIZE);
            if (options.place) {
                writeGeo(options.place);
                const ret = c.solEclipseWhenLoc(afterJd, flags, bufGeo, bufTret, bufAttr, backward, bufError);
                if (ret < 0) {
                    throw new SwissEphError(readError() ?? 'swe_sol_eclipse_when_loc failed', 'swe_sol_eclipse_when_loc');
                }
                const t = readDoubles(bufTret, ECLIPSE_TIMES_SIZE);
                const a = readDoubles(bufAttr, ECLIPSE_ATTR_SIZE);
                return {
                    kind: solarEclipseKind(ret),
                    central: (ret & EclipseFlag.Central) !== 0,
                    flags: ret,
                    timings: {
                        maximum: t[0],
                        partialBegin: optionalTime(t[1]), // birinci temas
                        totalityBegin: optionalTime(t[2]), // ikinci temas
                        totalityEnd: optionalTime(t[3]), // üçüncü temas
                        partialEnd: optionalTime(t[4]), // dördüncü temas
                        sunrise: optionalTime(t[5]),
                        sunset: optionalTime(t[6]),
                    },
                    local: {
                        magnitude: a[0], diameterRatio: a[1], obscuration: a[2],
                        coreShadowKm: a[3], azimuth: a[4], altitude: a[5],
                        apparentAltitude: a[6], nasaMagnitude: a[8],
                        saros: a[9], sarosMember: a[10],
                        visible: (ret & EclipseFlag.Visible) !== 0,
                    },
                };
            }
            const ret = c.solEclipseWhenGlob(afterJd, flags, options.type ?? 0, bufTret, backward, bufError);
            if (ret < 0) {
                throw new SwissEphError(readError() ?? 'swe_sol_eclipse_when_glob failed', 'swe_sol_eclipse_when_glob');
            }
            const t = readDoubles(bufTret, ECLIPSE_TIMES_SIZE);
            return {
                kind: solarEclipseKind(ret),
                central: (ret & EclipseFlag.Central) !== 0,
                flags: ret,
                timings: {
                    maximum: t[0],
                    localNoon: optionalTime(t[1]),
                    partialBegin: optionalTime(t[2]),
                    partialEnd: optionalTime(t[3]),
                    totalityBegin: optionalTime(t[4]),
                    totalityEnd: optionalTime(t[5]),
                    centreLineBegin: optionalTime(t[6]),
                    centreLineEnd: optionalTime(t[7]),
                },
            };
        },
        /**
         * The next lunar eclipse. With a `place`, the next one visible from
         * there, carrying umbral and penumbral magnitude and the Moon's altitude.
         *
         * Note that `place.altitude` is validated by Swiss Ephemeris and an
         * implausible height is rejected outright rather than clamped.
         */
        lunarEclipse(afterJd, options = {}) {
            assertLive();
            const flags = EPHEMERIS_FLAG[options.ephemeris ?? 'swiss'] | (options.flags ?? 0);
            const backward = options.backward ? 1 : 0;
            if (options.place && options.type !== undefined) {
                throw new SwissEphError('swe_lun_eclipse_when_loc takes no type filter; passing `type` for ' +
                    'a local search would be silently ignored.', 'lunarEclipse');
            }
            wasm.setValue(bufError, 0, 'i8');
            zeroDoubles(bufTret, ECLIPSE_TIMES_SIZE);
            zeroDoubles(bufAttr, ECLIPSE_ATTR_SIZE);
            const ret = options.place
                ? (writeGeo(options.place), c.lunEclipseWhenLoc(afterJd, flags, bufGeo, bufTret, bufAttr, backward, bufError))
                : c.lunEclipseWhen(afterJd, flags, options.type ?? 0, bufTret, backward, bufError);
            if (ret < 0) {
                const fn = options.place ? 'swe_lun_eclipse_when_loc' : 'swe_lun_eclipse_when';
                throw new SwissEphError(readError() ?? `${fn} failed`, fn);
            }
            const t = readDoubles(bufTret, ECLIPSE_TIMES_SIZE);
            const eclipse = {
                kind: lunarEclipseKind(ret),
                flags: ret,
                timings: {
                    maximum: t[0],
                    partialBegin: optionalTime(t[2]),
                    partialEnd: optionalTime(t[3]),
                    totalityBegin: optionalTime(t[4]),
                    totalityEnd: optionalTime(t[5]),
                    penumbralBegin: optionalTime(t[6]),
                    penumbralEnd: optionalTime(t[7]),
                    moonrise: optionalTime(t[8]),
                    moonset: optionalTime(t[9]),
                },
            };
            if (options.place) {
                const a = readDoubles(bufAttr, ECLIPSE_ATTR_SIZE);
                eclipse.local = {
                    magnitude: a[0], penumbralMagnitude: a[1],
                    azimuth: a[4], altitude: a[5], apparentAltitude: a[6],
                    saros: a[9], sarosMember: a[10],
                    visible: (ret & EclipseFlag.Visible) !== 0,
                };
            }
            return eclipse;
        },
        // --- heliacal ---------------------------------------------------------
        /**
         * The next heliacal event for an object — its first or last visible
         * appearance in the twilight.
         *
         * Unlike the rest of this library the answer depends on the atmosphere
         * and on the observer's eyesight, so it carries assumptions. Both are
         * typed and defaulted explicitly; see `Atmosphere` and `Observer`.
         *
         * `HeliacalEvent.EveningFirst` and `.MorningLast` apply only to the Moon
         * and the inner planets. `.AcronychalRising` and `.AcronychalSetting` are
         * declared upstream but not implemented.
         *
         * ```ts
         * const { visibilityBegin } = swe.heliacal(
         *   swe.julianDay(-3000, 7, 1), 'Sirius',
         *   { latitude: 30.0, longitude: 31.2, altitude: 20 },
         *   HeliacalEvent.HeliacalRising,
         * );
         * ```
         */
        heliacal(afterJd, object, place, event, options = {}) {
            assertLive();
            const flags = EPHEMERIS_FLAG[options.ephemeris ?? 'swiss']
                | (options.flags ?? 0) | (options.heliacalFlags ?? 0);
            writeGeo(place);
            writeDoubles(bufDatm, atmosphereToArray(options.atmosphere));
            writeDoubles(bufDobs, observerToArray(options.observer));
            wasm.stringToUTF8(object, bufObjectName, ERROR_BUFFER_SIZE);
            wasm.setValue(bufError, 0, 'i8');
            zeroDoubles(bufDret, 3);
            const ret = c.heliacalUt(afterJd, bufGeo, bufDatm, bufDobs, bufObjectName, event, flags, bufDret, bufError);
            if (ret < 0) {
                throw new SwissEphError(readError() ?? 'swe_heliacal_ut failed', 'swe_heliacal_ut');
            }
            const [visibilityBegin, optimum, visibilityEnd] = readDoubles(bufDret, 3);
            return {
                visibilityBegin,
                // Arcus visionis yönteminde SE bu ikisini sıfır bırakıyor.
                optimum: optionalTime(optimum),
                visibilityEnd: optionalTime(visibilityEnd),
                event,
                object: wasm.UTF8ToString(bufObjectName),
            };
        },
        // --- ayarlar ----------------------------------------------------------
        /**
         * Sets the sidereal (nirayana) mode, used together with `Flag.Sidereal`.
         * The setting is instance-wide — precisely why instances are isolated.
         */
        setSiderealMode(ayanamsa, t0 = 0, ayanT0 = 0) {
            assertLive();
            c.setSidMode(ayanamsa, t0, ayanT0);
        },
        /** The ayanamsa for a moment, in degrees. */
        ayanamsa(jd, ephemeris = 'swiss') {
            assertLive();
            wasm.setValue(bufError, 0, 'i8');
            const ret = c.getAyanamsaExUt(jd, EPHEMERIS_FLAG[ephemeris], bufPosition, bufError);
            if (ret < 0) {
                throw new SwissEphError(readError() ?? 'swe_get_ayanamsa_ex_ut failed', 'swe_get_ayanamsa_ex_ut');
            }
            return wasm.getValue(bufPosition, 'double');
        },
        /** Sets the observer's place for topocentric positions, with `Flag.Topocentric`. */
        setTopocentric(longitude, latitude, altitudeMetres = 0) {
            assertLive();
            c.setTopo(longitude, latitude, altitudeMetres);
        },
        /** Sets the search path for ephemeris files. */
        setEphemerisPath(path) {
            assertLive();
            c.setEphePath(path);
        },
        /**
         * Writes ephemeris files into the virtual filesystem and sets the path.
         * @returns total bytes written
         */
        mountEphemeris(files, dir = DEFAULT_EPHE_PATH) {
            assertLive();
            return mountFiles(files, dir);
        },
        /**
         * Fetches and mounts the files a given date range needs.
         *
         * Files must be loaded **before** any calculation: Swiss Ephemeris reads
         * them synchronously on the C side, and there is no way to await a fetch
         * in the middle of one. Because the file a date needs is computable from
         * the date (see `ephemeris/files.ts`), only the necessary files are
         * downloaded.
         *
         * A file that cannot be found is not an error — Swiss Ephemeris falls
         * back to Moshier for that range. The result reports what was loaded and
         * what was missing.
         *
         * ```ts
         * const swe = await createSwissEph();
         * await swe.loadEphemeris(new FetchEphemeris(), {
         *   fromYear: 1900, toYear: 2100, fixedStars: true,
         * });
         * ```
         */
        async loadEphemeris(source, range, dir = DEFAULT_EPHE_PATH) {
            assertLive();
            const wanted = requiredEphemerisFiles(range);
            // Paralel indir: 600 yıllık dilimler birbirinden bağımsız ve tarayıcıda
            // sıralı indirmek gecikmeyi dosya sayısıyla çarpardı.
            const results = await Promise.all(wanted.map(async (name) => [name, await source.read(name)]));
            const files = {};
            const loaded = [];
            const missing = [];
            for (const [name, content] of results) {
                if (content) {
                    files[name] = content;
                    loaded.push(name);
                }
                else
                    missing.push(name);
            }
            const bytes = mountFiles(files, dir);
            return { loaded, missing, bytes };
        },
        /**
         * Node only: mounts a real directory with **no copying**.
         *
         * `mountEphemeris()` copies files into memory, and since isolation means
         * one WebAssembly instance per `createSwissEph()`, that is 2 MB per
         * instance. Under NODEFS the same directory is shared by all of them,
         * which is what a server should use.
         *
         * Throws in a browser; use `loadEphemeris()` there.
         */
        mountEphemerisDirectory(hostDirectory, dir = DEFAULT_EPHE_PATH) {
            assertLive();
            const NODEFS = wasm.NODEFS;
            if (!NODEFS) {
                throw new SwissEphError('NODEFS is unavailable — mountEphemerisDirectory() only works under ' +
                    'Node. Use loadEphemeris() in a browser.', 'mountEphemerisDirectory');
            }
            try {
                wasm.FS.mkdir(dir);
            }
            catch {
                // Zaten var.
            }
            wasm.FS.mount(NODEFS, { root: hostDirectory }, dir);
            c.setEphePath(dir);
        },
        /**
         * Closes open files and frees the buffers. The instance is unusable
         * afterwards.
         */
        dispose() {
            if (disposed)
                return;
            c.close();
            for (const ptr of [bufPosition, bufError, bufName, bufCusps,
                bufCuspSpeed, bufAscmc, bufAscmcSpeed,
                bufGeo, bufHorIn, bufHorOut,
                bufTret, bufAttr, bufDatm, bufDobs, bufDret,
                bufObjectName]) {
                wasm._free(ptr);
            }
            disposed = true;
        },
        /** Support for `using` declarations (TypeScript 5.2+). */
        [Symbol.dispose]() {
            api.dispose();
        },
    };
    return api;
}
//# sourceMappingURL=instance.js.map