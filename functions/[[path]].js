const APP_SHELL_PATH = '/';

function isAppRouteRequest(request, url) {
  const method = request.method.toUpperCase();
  const fileName = url.pathname.split('/').pop() || '';

  return (method === 'GET' || method === 'HEAD')
    && !fileName.includes('.')
    && !url.pathname.startsWith('/cdn-cgi/');
}

function requestForPath(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url.toString(), request);
}

export async function onRequest(context) {
  const { request, env } = context;
  const assetResponse = await env.ASSETS.fetch(request);

  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  const url = new URL(request.url);

  if (!isAppRouteRequest(request, url)) {
    return assetResponse;
  }

  return env.ASSETS.fetch(requestForPath(request, APP_SHELL_PATH));
}
