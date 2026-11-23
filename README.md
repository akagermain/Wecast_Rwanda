# WeCast Rwanda

WeCast Rwanda is a web application that helps people find times to spend outdoors using weather forecasts. You search for a location in Rwanda, choose a day and activity duration, and set the highest rain chance you're comfortable with.

The Overview shows current conditions, hourly weather, and three-day outlook. The activity planner lets users search locations in Rwanda and filter recommendations by day, duration, and maximum rain chance.

- Live app: [WeCast Rwanda](https://www.agermain.tech/)
- Demo video:

**Note**: In this activity I used agermain.tech as domain because it is the one that I currently own only, but I will buy another one specifically for WeCast later.

## Run locally

From the project folder, start the Node.js development server and open http://127.0.0.1:4173.

```bash
node scripts/serve.mjs
```

WeCast uses HTML, CSS, and JavaScript. The browser calls Open-Meteo directly through it's API.
`Run node --test` to check forecast parsing, request error handling, caching, and recommendation logic. The local test run passed 26 of 26 tests.

## Weather data and recommendations
| API | Purpose in WeCast
| [Open-Meteo Forecast API](https://open-meteo.com/en/docs) `/v1/forecast` | Retrieves current conditions and three days of hourly and daily forecasts for the selected coordinates. |
| [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) `/v1/search` | Finds places using country code, eg = RW, and returns coordinates for the forecast. |

The planner looks for consecutive hours between 06:00 and 18:00 Rwanda time. Each hour must meet the selected rain limit, have a temperature of 12-32°C and wwind of at most 25 km/h, and have no forecast thudnerstom. The best match has the lowest peak hourly rain chance. The interface shows a message when no location or suitable window is found.

Open-Meteo's free non-commercial service requires no API key and lists limits of 600 calls per minute, 5000 per hour, and 10,000 per day. WeCasr caches API responses for ten minutes. Visitors need no login. Keep environment files and private keys out of Git using `.gitignore`. [Open-Meteo terms](https://open-meteo.com/en/terms)

Forecast data is provided by Open-Meteo under CC BY 4.0. Location data comes from GeoNames through Open-Meteo. WeCast transforms the forecast data into activity recommendations. [Data sources and license](https://open-meteo.com/en/licence)

## Deployment

#### Web01 and web02
Copy the same `Public/` directory  to `/var/www/wecast-rwanda/public/` on each server. 
Configure Nginx to listen on port 80 for `server_name wecast.internal`, with that directory as its root and index.html as its index. 
Set `X-Served-By` to `Web01` or `Web02` on the respective server. 
Run `sudo nginx -t`
Then `sudo nginx -s reload`

#### LB01 
In the existing HTTPS frontend in `/etc/haproxy/haproxy.cfg`, the public homepage redirects to `/wecast` with `302`. The `/wecast/` route selects `wecast_out`, which removes the prefix and sends the `Host` header expected by both Nginx sites.

```haproxy
backend wecast_out
    mode http
    balance roundrobin
    http-request replace-path ^/wecast/(.*)$ /\1
    http-request set-header host wecast.internal
    server web01 WEB01_PRIVATE_IP:80 check
    server web02 WEB02_PRIVATE_IP:80 check
```

**Note:** I got the private ip address by `hostname -I`

Use the assigned private addresses in the backend.
Validate with `sudo haproxy -c -f /etc/haproxy/haproxy.cfg`
Then run `sudo systemctl reload haproxy`

## Verification
The public home page returned 302 followed by 200 at `/wecast/`. All ten requests through LB01 returned 200, and the responses included both **X-Served-By: Web01** and **X-Served-By: Web02**.
[Check saved verification log here](docs/evidence/lb01-20261122T215858Z.txt)

## Development challenges

- **Hourly rain timing.** Open-Meteo's rain probability applies to the preceding hour. WeCast assigns a reading timestamped 07:00 to the 06:00 - 07:00 slot. [Forecast documentation](https://open-meteo.com/en/docs#hourly-parameter-definition)

- **Places with the same name.** Throughout the development, I could search for places and because many regions share the same name, I couldn't find the intended one. This was developed such that when you search for a place, it shows you a list and you choose the preferred one in case the one you searched for share the name with many places.

**Note:** For more detailed instruction for deployment check the README in deploy directory by [Clicking here](/deploy/README.md)