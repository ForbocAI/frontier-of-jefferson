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
  const url = new URL(request.url);
  const appRouteRequest = isAppRouteRequest(request, url);
  const assetResponse = await env.ASSETS.fetch(request);

  if (assetResponse.status !== 404
    && !(appRouteRequest && assetResponse.status >= 300 && assetResponse.status < 400)) {
    return assetResponse;
  }

  if (!appRouteRequest) {
    return assetResponse;
  }

  return env.ASSETS.fetch(requestForPath(request, APP_SHELL_PATH));
}
