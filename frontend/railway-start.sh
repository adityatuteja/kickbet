#!/bin/sh
# Railway sets $PORT; rewrite nginx config to listen on it
if [ -n "$PORT" ]; then
  sed -i "s/listen 80;/listen $PORT;/g" /etc/nginx/conf.d/default.conf
fi
