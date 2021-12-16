const { RbacAuthorizationApi, V1TCPSocketAction } = require('@kubernetes/client-node');
const k8s = require('@kubernetes/client-node');
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require('constants');
const {Base64} = require('js-base64');

const fs = require('fs');


ACCOUNT_NAME = '-account';
ROLEBINDING_NAME = '-binding';
ENDPOINT_NAME= '-endpoint';

module.exports = class K8sClient{

    constructor(config){
        this.k8sCfg ={}
        this.k8sCfg.user = {
            name: 'manager',
            token: config.token
        }
        this.k8sCfg.cluster = {
            name: 'default-cluster',
            server: config.server,
            skipTLSVerify: true,
        }
        this.k8sCfg.context = {
            cluster: this.k8sCfg.cluster.name,
            user: this.k8sCfg.user.name,
            name: this.k8sCfg.cluster.name+this.k8sCfg.user.name
        }
        const kc = new k8s.KubeConfig();
        kc.loadFromOptions({
            'clusters': [this.k8sCfg.cluster],
            'users': [this.k8sCfg.user],
            'contexts': [this.k8sCfg.context],
            'currentContext': this.k8sCfg.context.name
        })
        this.k8sCoreV1API = kc.makeApiClient(k8s.CoreV1Api);
        this.k8sRbacAuthAPI = kc.makeApiClient(k8s.RbacAuthorizationV1Api);
    }

    async getNodesNumber(){
        try{
            const results = await this.k8sCoreV1API.listNode();
            const nodes = results.response.request.req.res.body.items;

            let nodeNumber = nodes.length;

            for(let i=0; i<nodes.length; i++){
                const nodeState = nodes[i].status.conditions[4];
                if(nodeState.status != 'True'){
                    nodeNumber--;
                }
            }
            return nodeNumber;
        }catch(e){
            return e.response.request.req.res.body.message;
        }
    }

    async createNamespace(newName){
        try{
            const res = await this.k8sCoreV1API.createNamespace({
                metadata:{
                    name: newName
                }
            });
            return '';
        }catch(e){
            const errMsg = e.response.request.req.res.body.message;
            return errMsg;
        }
    }

    async createAccount(namespace){
        try{
            const res = await this.k8sCoreV1API.createNamespacedServiceAccount(namespace,{
                metadata:{
                    name: namespace+ACCOUNT_NAME,
                    namespace: namespace
                }
            })
            return '';
        }catch(e){ 
            const errMsg = e.response.request.req.res.body.message;
            return errMsg;
        }   
    }

    async createEndpoints(namespace, replicas, ports){
        let endPointsInfo = [];
        
        for(let i=0; i<replicas; i++){
            let label = {};
            label[namespace] = (i+1)+'';

            let setPorts = this._setServicePorts(ports);
            setPorts.push({
                name: 'etcdclient',
                port: 2379,
                protocol: 'TCP',
                targetPort: 2379
            },
            {
                name: 'etcdserver',
                port: 2380,
                protocol: 'TCP',
                targetPort: 2380
            });
            endPointsInfo.push({
                metadata:{
                    'name': namespace+'-endpoint'+(i+1),
                    'lables': label
                },
                spec:{
                    ports: setPorts,
                    selector: label,
                    type: 'LoadBalancer'
                },
            });
        } 
        try{
            for(let i=0; i< replicas; i++){
                await this.k8sCoreV1API.createNamespacedService(namespace,endPointsInfo[i]);
            }
            let endpoints = [];
            for(let i=0; i< replicas; i++){
                const endpointName = endPointsInfo[i].metadata.name;
                const res = await this.k8sCoreV1API.readNamespacedService(endpointName,namespace);
                const curEndpoint = res.response.request.req.res.body.status.loadBalancer.ingress[0].ip
                endpoints.push(curEndpoint);
            }

            return {value: endpoints, msg: ''};
        }catch(e){ 
            console.log(e);
            const errMsg = e.response.request.req.res.body.message;
            return {
                value: '',
                msg:'Failed to create endpoint'
            };
        }  
    }

    async assignPermissionAccount(namespace,replicas){
        try{
            const res = await this.k8sRbacAuthAPI.createClusterRoleBinding({
                metadata:{
                    name: namespace+ROLEBINDING_NAME+'-'+replicas,
                },
                roleRef: {
                    kind: 'ClusterRole',
                    name: 'cluster-admin',
                    apiGroup: 'rbac.authorization.k8s.io'
                },
                subjects: [{
                    kind: 'ServiceAccount',
                    name: namespace+ACCOUNT_NAME,
                    namespace: namespace
                }] 
            })
            return '';
        }catch(e){ 
            const errMsg = e.response.request.req.res.body.message;
            return errMsg;
        } 
    }

    async readAccessToken(namespace, serviceAccount){
        try{
            const readedSA = await this.k8sCoreV1API.readNamespacedServiceAccount(serviceAccount, namespace);
            const secreteName = readedSA.response.request.req.res.body.secrets[0].name
            const readedTK = await this.k8sCoreV1API.readNamespacedSecret(secreteName ,namespace);
            const accessToken = Base64.decode(readedTK.response.request.req.res.body.data.token);
            const caCrt = readedTK.response.request.req.res.body.data['ca.crt'];
            return {
                value: {
                    accessToken: accessToken,
                    caCrt: caCrt
                },
                msg: ''
            }
        }catch(e){
            console.log(e)
            return {
                value: {},
                msg: 'Failed read accessToken...'
            }
        }
    }

    _setServicePorts(ports){
        let specificPorts = [];
        for(let i=0; i<ports.length; i++){
            const curPort = ports[i];
            specificPorts.push({
                name: `scvport-${i}`,
                port: curPort,
                targetPort: curPort
            })
        }
        return specificPorts;
    }
}