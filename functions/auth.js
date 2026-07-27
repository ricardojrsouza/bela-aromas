export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const redirectUri = `${url.origin}/callback`;
  const githubAuthUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${context.env.GITHUB_CLIENT_ID}` +
    `&scope=repo,user` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;
  return Response.redirect(githubAuthUrl, 302);
}
