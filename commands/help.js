exports.help = function (options) {
  console.log(`
  * vrutils 커맨드
   - buildenv : 빌드 환경 설정용 TypeScript파일 생성
     기본값 : ${options.buildenv().searchThrough.join(", ")} 중 가장 먼저 찾아진 파일을 기준으로 환경설정 진행
     options :
       transpile : 빌드 환경 설정 후 지정된 폴더(transpileOutDir)에 js로 파일 생성
 
   - copystring : 스트링 폴더 복사. 옵션의 searchThrough에 있는 파일 중 하나에 searchFor가 정의되어 있어야 함
     기본값 : ${options.copystring().searchThrough.join(", ")} 에서 ${options.copystring().searchFor}를 찾음

   - parseurl : 로컬 작업폴더의 pages 하위에 있는 파일들을 파싱하여 url을 추출

   - image : 이미지 파일 최적화
     기본값 : "${options.options.image.src}" 폴더 내의 [${options.options.image.extensions}]이미지를 최적화하여 "${options.options.image.dst}/${options.options.image.src}"에 저장
      
 
  * 사용 예시
   - vrutils buildenv
   - vrutils buildenv transpile
   - vrutils copystring
   - vrutils parseurl
 `);
};
