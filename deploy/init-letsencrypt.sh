#!/bin/sh
# Cấp chứng chỉ Let's Encrypt lần đầu (webroot) cho DebtFlow.
# Dùng:  DOMAIN=debtflow.example.com EMAIL=ban@email.com sh deploy/init-letsencrypt.sh
# Yêu cầu: DNS domain đã trỏ về VPS, stack prod đang chạy (nginx phục vụ cổng 80).

set -e
: "${DOMAIN:?Cần DOMAIN=...}"
: "${EMAIL:?Cần EMAIL=...}"

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "[tls] xin chứng chỉ cho ${DOMAIN}..."
docker run --rm \
  -v "$(basename "$(pwd)")_letsencrypt:/etc/letsencrypt" \
  -v "$(basename "$(pwd)")_certbot_www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email

echo "[tls] sinh cấu hình nginx SSL từ template..."
sed "s/\${DOMAIN}/${DOMAIN}/g" nginx/nginx-ssl.conf.template > nginx/nginx.conf

echo "[tls] rebuild nginx với cấu hình SSL..."
$COMPOSE up -d --build nginx

echo "[tls] XONG — https://${DOMAIN}"
echo "[tls] Gia hạn (thêm cron mỗi tháng):"
echo "  docker run --rm -v ..._letsencrypt:/etc/letsencrypt -v ..._certbot_www:/var/www/certbot certbot/certbot renew && $COMPOSE restart nginx"
