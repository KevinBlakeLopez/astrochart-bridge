/*
 * Native reference harness for Swiss Ephemeris visibility functions.
 * Reads one command per line on stdin and prints one JSON object per line.
 * State (topo, ephemeris path, swehel.c's internal caches) persists across
 * lines, which is the point of several experiments.
 *
 *   ephe <path>
 *   vlm <label> <tjd_ut> <lon> <lat> <alt> <press> <temp> <rh> <vr> <age> <sn> <object> <helflag>
 *   azalt <label> <tjd_ut> <lon> <lat> <alt> <press> <temp> <ipl> <iflag>
 *   pheno <label> <tjd_ut> <ipl> <iflag>
 *   calc <label> <tjd_ut> <ipl> <iflag>
 *   heliacal <label> <tjd_ut> <lon> <lat> <alt> <press> <temp> <rh> <vr> <age> <sn> <object> <event> <helflag>
 *   rise <label> <tjd_ut> <ipl> <lon> <lat> <alt> <press> <temp> <rsmi> <iflag>
 *   topo <lon> <lat> <alt>
 *   version
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "swephexp.h"

static void json_string(const char *s) {
  putchar('"');
  for (; *s; s++) {
    if (*s == '"' || *s == '\\') { putchar('\\'); putchar(*s); }
    else if (*s == '\n') fputs("\\n", stdout);
    else putchar(*s);
  }
  putchar('"');
}

/* NaN and infinities are not JSON: they print as the strings "NaN", "Infinity". */
static void json_doubles(const char *key, const double *v, int n) {
  printf(",\"%s\":[", key);
  for (int i = 0; i < n; i++) {
    if (i) putchar(',');
    if (isnan(v[i])) fputs("\"NaN\"", stdout);
    else if (isinf(v[i])) fputs(v[i] > 0 ? "\"Infinity\"" : "\"-Infinity\"", stdout);
    else printf("%.17g", v[i]);
  }
  putchar(']');
}

int main(void) {
  char line[2048];
  while (fgets(line, sizeof line, stdin)) {
    char cmd[32] = "", label[128] = "", object[AS_MAXCH] = "", serr[AS_MAXCH] = "";
    if (sscanf(line, "%31s", cmd) != 1) continue;
    if (strcmp(cmd, "ephe") == 0) {
      char path[1024] = "";
      sscanf(line, "%*s %1023s", path);
      swe_set_ephe_path(path);
      printf("{\"cmd\":\"ephe\",\"path\":"); json_string(path); puts("}");
    } else if (strcmp(cmd, "close") == 0) {
      swe_close();
      printf("{\"cmd\":\"close\"}\n");
    } else if (strcmp(cmd, "version") == 0) {
      char v[AS_MAXCH];
      printf("{\"cmd\":\"version\",\"version\":"); json_string(swe_version(v)); puts("}");
    } else if (strcmp(cmd, "topo") == 0) {
      double lon, lat, alt;
      sscanf(line, "%*s %lf %lf %lf", &lon, &lat, &alt);
      swe_set_topo(lon, lat, alt);
      printf("{\"cmd\":\"topo\"}\n");
    } else if (strcmp(cmd, "vlm") == 0) {
      double tjd, geo[3], datm[4], dobs[6] = {0}, dret[12];
      int helflag;
      sscanf(line, "%*s %127s %lf %lf %lf %lf %lf %lf %lf %lf %lf %lf %255s %d", label, &tjd,
             &geo[0], &geo[1], &geo[2], &datm[0], &datm[1], &datm[2], &datm[3], &dobs[0], &dobs[1],
             object, &helflag);
      double geo_in[3], datm_in[4], dobs_in[6];
      memcpy(geo_in, geo, sizeof geo); memcpy(datm_in, datm, sizeof datm); memcpy(dobs_in, dobs, sizeof dobs);
      for (int i = 0; i < 12; i++) dret[i] = -999; /* sentinel: shows which slots are written */
      int ret = swe_vis_limit_mag(tjd, geo, datm, dobs, object, helflag, dret, serr);
      printf("{\"cmd\":\"vlm\",\"label\":"); json_string(label);
      printf(",\"ret\":%d", ret);
      json_doubles("dret", dret, 12);
      json_doubles("datm_in", datm_in, 4); json_doubles("datm_after", datm, 4);
      json_doubles("dobs_in", dobs_in, 6); json_doubles("dobs_after", dobs, 6);
      json_doubles("geo_after", geo, 3);
      printf(",\"object_after\":"); json_string(object);
      printf(",\"serr\":"); json_string(serr); puts("}");
    } else if (strcmp(cmd, "azalt") == 0) {
      double tjd, geo[3], press, temp, x[6], xin[3], xaz[3];
      int ipl, iflag;
      sscanf(line, "%*s %127s %lf %lf %lf %lf %lf %lf %d %d", label, &tjd, &geo[0], &geo[1], &geo[2],
             &press, &temp, &ipl, &iflag);
      swe_set_topo(geo[0], geo[1], geo[2]);
      int ret = swe_calc_ut(tjd, ipl, iflag | SEFLG_EQUATORIAL | SEFLG_TOPOCTR, x, serr);
      xin[0] = x[0]; xin[1] = x[1]; xin[2] = x[2];
      swe_azalt(tjd, SE_EQU2HOR, geo, press, temp, xin, xaz);
      printf("{\"cmd\":\"azalt\",\"label\":"); json_string(label);
      printf(",\"ret\":%d,\"azimuth_from_north\":%.17g,\"true_alt\":%.17g,\"apparent_alt\":%.17g,\"serr\":",
             ret, xaz[0] + 180 >= 360 ? xaz[0] - 180 : xaz[0] + 180, xaz[1], xaz[2]);
      json_string(serr); puts("}");
    } else if (strcmp(cmd, "pheno") == 0) {
      double tjd, attr[20];
      int ipl, iflag;
      sscanf(line, "%*s %127s %lf %d %d", label, &tjd, &ipl, &iflag);
      int ret = swe_pheno_ut(tjd, ipl, iflag, attr, serr);
      printf("{\"cmd\":\"pheno\",\"label\":"); json_string(label);
      printf(",\"ret\":%d,\"phase_angle\":%.17g,\"phase\":%.17g,\"elongation\":%.17g,\"diameter\":%.17g,\"magnitude\":%.17g,\"serr\":",
             ret, attr[0], attr[1], attr[2], attr[3], attr[4]);
      json_string(serr); puts("}");
    } else if (strcmp(cmd, "calc") == 0) {
      double tjd, x[6];
      int ipl, iflag;
      sscanf(line, "%*s %127s %lf %d %d", label, &tjd, &ipl, &iflag);
      int ret = swe_calc_ut(tjd, ipl, iflag, x, serr);
      printf("{\"cmd\":\"calc\",\"label\":"); json_string(label);
      printf(",\"ret\":%d", ret); json_doubles("x", x, 6);
      printf(",\"serr\":"); json_string(serr); puts("}");
    } else if (strcmp(cmd, "heliacal") == 0) {
      double tjd, geo[3], datm[4], dobs[6] = {0}, dret[50] = {0};
      int event, helflag;
      sscanf(line, "%*s %127s %lf %lf %lf %lf %lf %lf %lf %lf %lf %lf %255s %d %d", label, &tjd,
             &geo[0], &geo[1], &geo[2], &datm[0], &datm[1], &datm[2], &datm[3], &dobs[0], &dobs[1],
             object, &event, &helflag);
      int ret = swe_heliacal_ut(tjd, geo, datm, dobs, object, event, helflag, dret, serr);
      printf("{\"cmd\":\"heliacal\",\"label\":"); json_string(label);
      printf(",\"ret\":%d", ret); json_doubles("dret", dret, 3);
      printf(",\"serr\":"); json_string(serr); puts("}");
    } else if (strcmp(cmd, "rise") == 0) {
      double tjd, geo[3], press, temp, tret = 0;
      int ipl, rsmi, iflag;
      sscanf(line, "%*s %127s %lf %d %lf %lf %lf %lf %lf %d %d", label, &tjd, &ipl, &geo[0], &geo[1], &geo[2],
             &press, &temp, &rsmi, &iflag);
      int ret = swe_rise_trans(tjd, ipl, NULL, iflag, rsmi, geo, press, temp, &tret, serr);
      printf("{\"cmd\":\"rise\",\"label\":"); json_string(label);
      printf(",\"ret\":%d,\"tret\":%.17g,\"serr\":", ret, tret);
      json_string(serr); puts("}");
    } else {
      printf("{\"cmd\":\"unknown\",\"line\":"); line[strcspn(line, "\n")] = 0; json_string(line); puts("}");
    }
    fflush(stdout);
  }
  swe_close();
  return 0;
}
