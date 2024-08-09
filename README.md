# vrutils

### 목적
노드 환경에서 반복적으로 수행하는 작업을 모듈화
ex) copystring, buildenv

---

### 사용법
node 프로젝트에서 다음을 실행하여 설치
> npm i -D vrap-stan/vrutils

필요한 옵션은 각 프로젝트에서 다음 파일에 정의하여 사용
> vrutils.config.json

---

### Main Entry points

* vrutils.js : 메인 엔트리포인트
* OptionBuilder.js : vrutils.js 에서 vrutils.config.json을 읽어온 후 각 모듈(copystring, buildenv 등)로 옵션을 object형태로 전달해준다
* defaultOptions.json : 각 모듈에서 사용하는 기본 옵션값을 정의

```
유틸을 작성하고 싶다면 다음부터 시작하는 것이 좋다 :
1. npm start example
2. commands/example.js
```
