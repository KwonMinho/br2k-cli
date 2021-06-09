sudo rm /etc/docker/certs.d/203.250.77.152
sudo mkdir /etc/docker/certs.d/203.250.77.152
sudo cp ~/share/ca.crt /etc/docker/certs.d/203.250.77.152
sudo systemctl restart docker
