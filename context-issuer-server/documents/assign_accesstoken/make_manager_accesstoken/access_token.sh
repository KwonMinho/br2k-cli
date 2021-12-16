#!/bin/sh
kubectl create -f ./service_account.yaml
kubectl create clusterrolebinding ?customName? --clusterrole=cluster-admin --serviceaccount=default:manager

