/**
 * Shared Swagger UI setup for Progz API docs.
 * - Persists Bearer token after login (localStorage — not cookies)
 * - Masks tokens/passwords in response display
 * - Hides Schemas section
 */
(function () {
  const SENSITIVE_KEYS = new Set([
    "accessToken",
    "refreshToken",
    "token",
    "password",
    "currentPassword",
    "newPassword",
  ]);

  function maskSensitive(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(maskSensitive);
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = "••••••••";
      } else if (val && typeof val === "object") {
        out[key] = maskSensitive(val);
      } else {
        out[key] = val;
      }
    }
    return out;
  }

  window.initProgzSwagger = function (yamlUrl) {
    const ui = SwaggerUIBundle({
      url: yamlUrl,
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      defaultModelsExpandDepth: -1,
      defaultModelExpandDepth: 0,
      docExpansion: "full",
      tryItOutEnabled: true,
      persistAuthorization: true,
      responseInterceptor: (response) => {
        if (!response.text) return response;
        try {
          const data = JSON.parse(response.text);

          if (response.ok && /\/auth\/login/i.test(response.url) && data.accessToken) {
            ui.authActions.authorize({
              bearerAuth: {
                name: "bearerAuth",
                schema: { type: "http", scheme: "bearer", in: "header" },
                value: data.accessToken,
              },
            });
          }

          response.text = JSON.stringify(maskSensitive(data), null, 2);
        } catch (_) {
          /* non-JSON response */
        }
        return response;
      },
    });
    window.ui = ui;
  };
})();
