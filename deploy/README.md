# Deployment preparation

No server changes have been made. These instructions assume dedicated ubuntu servers. Confirm the OS and existing Nginx layout before applying them. 

## Prerequesites

Obtain the assigned web01, web02, and LB01 hosts, SSH username and port, and local key path if needed. Keep secrets out of Git, screenshots and the demo. Confirm that LB01 can reach both web servers on port 80, and the external address domain to be submitted.

On each server, perform these read-only checks first:
```sh
hostname
cat /etc/os-release
nginx -V
ss -lnt
```

## Web01 and web02

1. Install nginx if it is missing using the OS's supported package manager.
2. Copy the same `public/` directory to `/var/www/wecast-rwanda/public` on each web server. Create the parent directory with appropriate administrative access.
3. Configure the sites configuration as required on both servers
    Add this to both config files in site-available on both servers

```
server {
    listen 80;
    server_name _;
    root /var/www/wecast-rwanda/public;
    index index.html;

    add_header X-Server-By "web01" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "Strict-origin-when-cross-origin" always;

    location / {
        try_files $uri $uri/ =404;
        expires -1;
    }

    location = /health {
        access_log off;
        default_type text/plain;
        expires -1;
        return 200 "Wecast web server OK\n";
    }

}
```

**Note:** For the second server, use **web02** in place of **web01**. 

4. Enable the dedicated site.
5. Validate before reloading:

```sh
sudo nginx -t
sudo nginx -s reload
curl -I http://127.0.0.1
curl http://127.0.0.1/health
```

Do not reload if the validation fails. Verify `text/javascript` or another valid JavaScript MIME type for `js/app.js` and `text/css` for `/css/styles.css`. The main nginx configuration normally includes `mime.types`; add the OS's standard include if missing.

## LB01

1. From LB01, check that both real web-server addresses return the site and their distinct headers:

```sh
curl -I http://WEB01_PRIVATE_IP/
curl -I http://WEB02_PRIVATE_IP/
```

**Note:** To obtain these private IPs, on each of the web servers run the command `hostname -I`. The IPs provided are the private IPs.

2. Create the config file for the load balancer and add the following:
```
upstream wecast_web {
    server WEB01_PRIVATE_IP:80 max_fails=1 fail_timeout=10s;
    server WEB02_PRIVATE_IP:80 max_fails=1 fail_timeour=10s;
}

server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://wecast_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remot_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwaded_for;
        proxy_set_header X-Forwaded-Proto $scheme;
        proxy_connect_timeout 3s;
        proxy_read_tmeout 15s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next upstream_tries 2;
    }
}
```

3. Run `sudo nginx -t`, then reload only when it succeeds.
4. Access the website through the real LB address and verify both pages, search, filtering and API requests. 

**Note:** Record distribution with new, uncached HTTP requests. On a linux client, run:

```sh
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    curl -sS -D - -o /dev/null "http://LB01_ADDRESS/?check=$i"
done
```

Inspect `X-Served-By` across the results. Nginx may not alternate perfectly for one test client across multiple workers; the evidence should show successful responses from both servers. If HTTPS is configured, test the HTTPS URL as well. Browser cache can hide which server handled a resource, so use request headers as evidence.