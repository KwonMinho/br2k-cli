# br2k 프레임워크용 context 발급 서버

서비스 배포자가 쿠버네티스에서 사용 가능한 리소스 정보들이 명세되어 있는 `context`를 자동으로 발급해주는 서버

<br />
## 개발 로그
- 절차 미구현 [2. Check Indentity of deployer, 5. 서비스 레지스트리에 저장하는 부분], 그 외에는 다 구현 

## prerequire

ref: prerequire-br2k-CLI folder

1. labeling work
2. create k8s cluster access-token


## 발급 절차

<img src="/context-issuer-server/res/Context Issuer.png" width=75%  height=75% />

#### 1. Send CAR*

서비스 배포자가  `context(쿠버네티스에 복제 앱을 배포하기 위한 리소스 정보)`를 `context` 발급자인 Context-Issuer에게 CAR 형태로 요청


*Service Deployer*는 아래와 같은 정보를 *Context-Issuer*에게 보냄
- [CAR](#car-struct)
- CAR를 사인해서 만든 `signature`, `DID of deployer`
- signature 검증에 사용되는 `public key 정보(public key id)`


#### 2. Check Identity of deployer

*Context-Issuer*는 `did-auth` 기반으로 *Service Deployer*의 신원 확인

- *Service Deployer* 가 보내온 signature와 DID 기반으로 검증
- 검증 완료 후에, *Service Deployer*가 유저 리스트에(Local JSON or LDAP or DB) 존재하는 지 체크


#### 3. Check CAR content

CAR에 있는 요구 사항이 실현 가능한지 검사

**Situation** <br/>
CAR에서 원하는 복제 수가 10개지만  <br/>
현재 쿠버네티스 클러스터에서 가용할 수 있는 노드가 8개라면 <br/>
해당 요청은 거절될 수 있다.(또는 할당할 수 있는 만큼 리소스 할당)


#### 4. Creating context for CAR

context를 만드는 과정

1. 쿠버네티스에 필요한 자원을 만들어준다(ex. Create Service Object in k8s) 
2. 만든 자원과 CAR의 내용에 맞게  Context를 만들어준다


#### 5. Assign context to user(service deployer) 

*Service Deployer*에게 `context`를 할당

*Service Deployer*에게 `context`의 할당은 `Service Registry`를 통해서 이루어짐

1. *Context-Issuer*는  `Service Registry`에 `context`를 저장(이때, *Service Deployer*의 did(account)로 접근할 수 있게 저장)
2. *Context-Issuer*는 *Service Deployer*에게 할당되었다고 

#### 6. Send success MSG

*Context-Issuer*는 *Service Deployer*에게 `context`가 `Service Registry`에 할당되었다고 success MSG 보냄.

success MSG 구조는 아래와 같다.
- context가 저장된 위치 명세: {service registry address, service reigstry 배포 네트워크} 
- 저장된 시간 
- + 추가적으로 명세

#### 7. Get context at Service Registry 

*Service Deployer*는 해당 `Servcier Registry`에서 `context`를 가져올 수 있음


<br />
## CAR Struct

| attribute        |      type      |  desc | example
|----------        |:-------------: |------:|------:|  
| name             |  string        | Service Name| 'Bank APP' |
| replicas         |  int           | 앱을 복제할 수 있는 replicas 수|  |
| replicas/isMax   |  true/false    |  *true* 일때 replicas가 k8s cluster 노드 개수보다 클 경우, k8s cluster 노드 개수만큼 context를 할당받음 <br/> *false* 일 때 replicas가 k8s cluster 노드 개수보다 클 경우, 해당 요청을 취소함 | |
| ports            |  array         |  할당받고 싶은 port들 |  [2000,3000,9999,3399]   |
| ports/isReplace  |  true/fals     |  *true* 일때 ports 중에 쿠버네티스에서 이미 사용하고 있다면, 사용할 수 없는 port를 다른 port로 할당받음 <br/> *false* 일 때 원하는 port들을 못받으면 요청 거절 |   |
| mounts/service   |  string        |   |  |
| mounts/etcd      |  string        |   |  |
