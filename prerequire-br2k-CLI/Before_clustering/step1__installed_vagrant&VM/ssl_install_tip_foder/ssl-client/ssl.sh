openssl genrsa -out client.key 4096
openssl req -new -x509 -text -key client.key -out client.cert
