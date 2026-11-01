# Stellarium Desktop

Chart Bridge can send a chart's moment and place to the Stellarium app on your computer, and read the sky Stellarium is showing back into Chart Bridge, to open in Astro-Seek or Stellarium Web or enter in astro.com. It talks to Stellarium through Stellarium's Remote Control plugin, at `127.0.0.1` on this computer, and nowhere else.

## Setting up Stellarium

The Remote Control plugin comes with Stellarium but is off until you turn it on. These steps were checked in Stellarium 25.1 on a Mac.

1. Open Stellarium and press **F2** (**fn+F2** on many Mac keyboards) for its Configuration window.
2. On the **Plugins** tab, select **Remote Control** and tick **Load at startup**.
3. Quit Stellarium (**⌘Q** on a Mac) and open it again. The plugin loads only when Stellarium starts.
4. Press **F2** again, select **Remote Control** on the **Plugins** tab and click **Configure**.
5. Tick **Server enabled**, and **Enable automatically on startup** so you don't have to next time. Leave **Port Number** at `8090` and **Access requires authentication** unticked, then click **Save settings**.

Under **Server enabled**, the window shows "Listening on" and your computer's network address. While the server is on, other devices on your network can control Stellarium too, not only Chart Bridge. Untick **Server enabled** when you're done if that matters on your network.

Leave **Enable CORS** unticked. Chart Bridge doesn't need it, and it lets websites control Stellarium.

## Sending a chart to Stellarium

1. Open the popup on a chart, as for **Open sky**.
2. Click **Send to Stellarium Desktop**. The first time, your browser asks whether Chart Bridge may connect to `127.0.0.1`. Allow it.
3. The popup says **Sent to Stellarium Desktop** once Stellarium shows the chart's moment and place.

Chart Bridge pauses Stellarium's clock, sets its latitude and longitude, sets the time, and then reads Stellarium's own status back to check all three took. An "ok" from Stellarium isn't enough: it answers "ok" even for values it ignored.

What changes in Stellarium, and what doesn't:

- The clock is paused at the chart's moment. Its play button, or **K**, starts it again.
- The place is named by its coordinates, such as `40.7167, -74`. Its altitude, landscape and planet stay as they were.
- Stellarium's time zone stays as it was, so its clock shows the moment in that time zone, not the birthplace's. The UTC is the chart's.
- The view, field of view, selected object and sky culture aren't touched.

The button is on every chart screen with a sky: a chart page's, once its UTC is decided, and a Stellarium Web tab's. The screenshot, pasted-text and AAF pages don't have it yet.

## Making Stellarium Desktop the default

After a chart has gone to Stellarium, the **Sent to Stellarium Desktop** screen offers **Use Stellarium Desktop by default**. Chart screens then lead with **Send to Stellarium Desktop** in the main style, and **Open sky** follows it in the secondary style. Nothing is sent without a click either way.

To change it back, use the line under the buttons on any chart screen: "Stellarium Desktop is your default for charts. **Make Stellarium Web the default**". The screen redraws at once with **Open sky** first again, and says "Stellarium Web is the default again. **Undo**". The same line is on the sent screen.

A Stellarium Web tab's screen keeps **Open chart in Astro-Seek** as its main button, since there is no sky to open there, but shows the same line. The choice is kept in the browser on this computer only, and isn't synced to your browser account.

## Checking whether Stellarium is ready

Once you've allowed Chart Bridge to connect to `127.0.0.1`, the popup checks Stellarium each time it opens on a chart, or on a page that isn't one. It asks Stellarium for its status, changes nothing, and gives up after a second. A grey line under the button then says what it found:

| Line | Meaning |
|---|---|
| Stellarium Desktop is open and ready. | Sending should work. |
| Stellarium Desktop isn't reachable right now. | Stellarium is closed, or its server is off. The button shows the setup steps. |
| Stellarium asks for a password… | The plugin's password is on. The button shows how to turn it off. |
| Something other than Stellarium is answering on port 8090. | Another program has the port. |
| Stellarium's observer is on another planet. | Pick a place on Earth first. |

Until you've allowed the connection, the popup doesn't check and shows no line: without permission the browser blocks the request, which would look like a closed Stellarium. The button works either way, and the line can be out of date if Stellarium opens or closes while the popup is open.

## Importing from Stellarium

On a page that isn't a chart, the popup offers **Import from Stellarium Desktop**. It reads the moment and place Stellarium is showing and offers **Open chart in Astro-Seek**, **Open sky** and **Enter in astro.com…**.

- Pause Stellarium's clock first. A running clock gives the moment Chart Bridge read it, and Stellarium doesn't move its clock while its window isn't being drawn, so that moment can lag behind.
- The time is read to the second, in UTC. Stellarium's place name and time zone aren't used: every destination takes UTC and coordinates.
- Stellarium keeps coordinates to about 0.00001°, so a place can come back a fraction of a metre from where it was sent, such as `-33.86667` for `-33.866667`.

## When it doesn't work

| The popup says | What to do |
|---|---|
| Stellarium Desktop isn't reachable | Stellarium is closed, the plugin isn't loaded, or its server is off. These look the same from the browser. Follow the setup steps above. |
| Chart Bridge needs your permission | Click **Try again** and allow the connection to `127.0.0.1`. |
| Stellarium asks for a password | Chart Bridge doesn't use the plugin's password. Untick **Access requires authentication**, click **Save settings**, then untick and tick **Server enabled**. |
| Something else is using port 8090 | Another program answers on the port Chart Bridge uses, so nothing was sent. Quit it, then restart Stellarium's server. |
| Stellarium didn't take the whole chart | Stellarium answered, but its status afterwards didn't match the chart. Try again. |
| Stellarium isn't on Earth | Pick a place on Earth in Stellarium's Location window (**F6**). |
| This date can't go to Stellarium | Chart Bridge sends and reads dates from 15 October 1582 to the year 9999. Before that day Stellarium counts in the Julian calendar. |

## For developers

`extension/core/stellarium-desktop.js` turns a sky into the plugin's requests and checks its status; `extension/stellarium-desktop.js` sends them; `extension/desktop-model.js` decides the popup's screens. They follow the plugin's source in Stellarium v25.1 (`plugins/RemoteControl/src`).

- `GET /api/main/status` gives `time.jday`, a Julian Day in UT, and `location.latitude`, `longitude` and `planet`. Every response, a 401 included, has the header `Server: Stellarium RemoteControl <version>`; Chart Bridge sends nothing to a server without it.
- `POST /api/main/time` with `timerate=0`, then `POST /api/location/setlocationfields` with `latitude` and `longitude`, then `POST /api/main/time` with `time`. Pausing first stops the clock running on between the place and the time.
- The parameters go in the query string, with no body. Stellarium's HTTP server reads a form body only when the header is spelled `Content-Length`; fetch in Node sends `content-length`, and every POST was ignored.
- A successful transfer is the time within a second, the clock paused, and the coordinates within 0.0001°.
- The server listens on every network interface (`*:8090`), whatever the browser connects to.

Run against Stellarium 25.1.0 from Node on 2026-11-01: New York 1944-01-10 16:00 UTC and Sydney 2024-01-14 21:00 UTC applied with no time error, read back, and opened the expected Stellarium Web and Astro-Seek links.

Not yet checked in a browser: whether Chrome's local network access rules prompt or block, whether Firefox closes the popup while it asks for the permission, and Safari. Manual test 17 covers the popup.

### Opening Stellarium from the browser

Chart Bridge can't start Stellarium. Stellarium registers no URL scheme on macOS, only `.ssc` script files, and a browser extension can start a program only through native messaging, which needs a separate helper program installed. Stellarium's command line takes `--latitude`, `--longitude`, `--sky-date` and `--sky-time`, so such a helper could open it at a chart's moment, but Chart Bridge has none.
