#! /bin/sh

echo 'First start by creating your CA key'
openssl genrsa -out ca.key 4096


echo 'Next we need to create our CA certificate
Here you have to fill in information about your company, it does not really matter as you have to trust it yourself.'
openssl req -new -x509 -days 1826 -key ca.key -out ca.crt


echo 'Next we have to create a certificate for that server we want to use SSL on'
openssl genrsa -out server.key 4096



echo 'After that we need certificate request, it is here you have to fill in the domain name that you are going to use the certificate with:'
openssl req -new -key server.key -out server.csr


echo 'Then lastly we can create our server certificate'
openssl x509 -req -days 730 -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt

echo 'Now you can use server.crt and server.key on your https server
'



