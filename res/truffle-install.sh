#!/bin/bash

sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get -y install curl git vim build-essential
sudo npm install -g truffle