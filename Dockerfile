FROM node:22-alpine

RUN apk add --no-cache ca-certificates curl \
  && curl -kfsSL --retry 3 "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt" \
     -o /usr/local/share/ca-certificates/russian_trusted_root_ca.crt \
  && update-ca-certificates

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/src ./src
COPY backend/import ./import
COPY backend/storage ./storage
COPY frontend /app/frontend

ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/russian_trusted_root_ca.crt
EXPOSE 3001

CMD ["npm", "start"]
