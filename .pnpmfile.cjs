/**
 * pnpm 이 패키지 정보를 읽을 때 실행하는 훅입니다. (https://pnpm.io/pnpmfile)
 *
 * drizzle-orm 은 여러 DB 드라이버를 선택적 peer 의존성으로 선언합니다.
 * pnpm 은 워크스페이스 어딘가에 설치된 패키지로 선택적 peer 를 채우기 때문에,
 * 테스트 전용 PGlite(packages/test-postgres)가 server 의 drizzle-orm 에 연결되어
 * 운영 설치(pnpm deploy --prod)와 Docker 이미지에 포함됩니다.
 * 이 프로젝트는 drizzle-orm/pglite 를 사용하지 않으므로 해당 peer 선언을 제거합니다.
 *
 * 이 파일을 바꾸면 pnpm-lock.yaml 의 pnpmfileChecksum 도 바뀝니다. Dockerfile 은 lockfile 과 함께 이 파일을 복사합니다.
 */
function readPackage(pkg) {
  if (pkg.name === "drizzle-orm") {
    delete pkg.peerDependencies?.["@electric-sql/pglite"];
    delete pkg.peerDependenciesMeta?.["@electric-sql/pglite"];
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
