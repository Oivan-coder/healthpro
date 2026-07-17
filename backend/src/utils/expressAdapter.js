const http = require("http");

function createMiniExpress() {
  function createRouter(prefix = "") {
    const routes = [];
    const middlewares = [];

    function add(method, path, handler) {
      routes.push({ method, path: `${prefix}${path}`, handler });
    }

    function router(req, res, next) {
      const route = routes.find((item) => item.method === req.method && item.path === req.url.split("?")[0]);
      if (!route) return next ? next() : sendJson(res, 404, { error: "not_found" });
      return route.handler(req, res, next);
    }

    router._routes = routes;
    router._middlewares = middlewares;
    router.get = (path, handler) => add("GET", path, handler);
    router.post = (path, handler) => add("POST", path, handler);
    router.use = (pathOrRouter, maybeRouter) => {
      if (typeof pathOrRouter === "string" && maybeRouter?._routes) {
        maybeRouter._routes.forEach((route) => routes.push({ ...route, path: `${pathOrRouter}${route.path}` }));
        return;
      }
      if (pathOrRouter?._routes) {
        pathOrRouter._routes.forEach((route) => routes.push(route));
      }
    };
    return router;
  }

  function express() {
    const app = createRouter();
    const middlewares = [];
    const notFoundHandlers = [];
    const errorHandlers = [];

    app.use = (pathOrMiddleware, maybeRouter) => {
      if (typeof pathOrMiddleware === "string" && maybeRouter?._routes) {
        maybeRouter._routes.forEach((route) => app._routes.push({ ...route, path: `${pathOrMiddleware}${route.path}` }));
        return;
      }
      if (pathOrMiddleware?._routes) {
        pathOrMiddleware._routes.forEach((route) => app._routes.push(route));
        return;
      }
      if (typeof pathOrMiddleware === "function" && pathOrMiddleware.length === 4) {
        errorHandlers.push(pathOrMiddleware);
        return;
      }
      if (typeof pathOrMiddleware === "function" && pathOrMiddleware.length === 2) {
        notFoundHandlers.push(pathOrMiddleware);
        return;
      }
      if (typeof pathOrMiddleware === "function" && pathOrMiddleware.length <= 3) {
        middlewares.push(pathOrMiddleware);
        return;
      }
      if (typeof pathOrMiddleware === "function") notFoundHandlers.push(pathOrMiddleware);
    };

    app.listen = (port, callback) => {
      const server = http.createServer(async (req, res) => {
        decorateResponse(res);
        try {
          await runMiddlewares(req, res, middlewares);
          const route = app._routes.find((item) => item.method === req.method && item.path === req.url.split("?")[0]);
          if (route) return await route.handler(req, res, (error) => {
            if (error) throw error;
          });
          if (notFoundHandlers[0]) return notFoundHandlers[0](req, res);
          return res.status(404).json({ error: "not_found" });
        } catch (error) {
          if (errorHandlers[0]) return errorHandlers[0](error, req, res, () => {});
          return res.status(500).json({ error: error.message || "internal_error" });
        }
      });
      return server.listen(port, callback);
    };

    return app;
  }

  express.Router = () => createRouter();
  express.json = () => async (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
    let body = "";
    for await (const chunk of req) body += chunk;
    req.body = body ? JSON.parse(body) : {};
    next();
  };

  return express;
}

function decorateResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => sendJson(res, res.statusCode || 200, payload);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function runMiddlewares(req, res, middlewares) {
  let index = 0;
  return new Promise((resolve, reject) => {
    const next = (error) => {
      if (error) return reject(error);
      const middleware = middlewares[index++];
      if (!middleware) return resolve();
      try {
        middleware(req, res, next);
      } catch (err) {
        reject(err);
      }
    };
    next();
  });
}

function loadExpress() {
  try {
    return require("express");
  } catch (error) {
    return createMiniExpress();
  }
}

module.exports = loadExpress();
