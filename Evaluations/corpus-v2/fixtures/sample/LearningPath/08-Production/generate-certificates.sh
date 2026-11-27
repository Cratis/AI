#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
cd "$(dirname "$0")"
for name in CHRONICLE_CERTIFICATE_PASSWORD ENCRYPTION_CERTIFICATE_PASSWORD; do
    if [[ -z ${!name:-} ]]; then
        printf 'Set %s in the shell environment; see README.\n' "$name" >&2
        exit 1
    fi
done
if [[ -e certs ]]; then
    printf 'certs already exists; keep certificates with their data, or reset the entire local stack first.\n' >&2
    exit 1
fi
umask 077
mkdir certs
openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 365 \
    -subj '/CN=Learning Path Local CA' \
    -addext 'basicConstraints=critical,CA:TRUE' \
    -addext 'keyUsage=critical,keyCertSign,cRLSign' \
    -keyout certs/ca.key -out certs/ca.crt
openssl req -new -newkey rsa:3072 -nodes \
    -subj '/CN=chronicle' -keyout certs/tls.key -out certs/tls.csr
openssl x509 -req -in certs/tls.csr -CA certs/ca.crt -CAkey certs/ca.key \
    -CAcreateserial -days 365 -sha256 \
    -extfile <(printf '%s\n' 'basicConstraints=critical,CA:FALSE' \
        'keyUsage=critical,digitalSignature,keyEncipherment' 'extendedKeyUsage=serverAuth' \
        'subjectAltName=DNS:chronicle,DNS:keycloak,DNS:localhost,IP:127.0.0.1') \
    -out certs/tls.crt
openssl pkcs12 -export -out certs/chronicle.pfx -inkey certs/tls.key \
    -in certs/tls.crt -certfile certs/ca.crt -passout env:CHRONICLE_CERTIFICATE_PASSWORD
openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 365 \
    -subj '/CN=Learning Path Encryption' \
    -keyout certs/encryption.key -out certs/encryption.crt
openssl pkcs12 -export -out certs/encryption.pfx -inkey certs/encryption.key \
    -in certs/encryption.crt -passout env:ENCRYPTION_CERTIFICATE_PASSWORD
# The directory stays owner-only on the host; mounted files must be readable by
# the non-root Chronicle and Keycloak container users. Never publish this folder.
chmod 644 certs/ca.crt certs/tls.crt certs/tls.key certs/chronicle.pfx certs/encryption.pfx
printf 'Created local CA, TLS and encryption certificates in certs/.\n'
