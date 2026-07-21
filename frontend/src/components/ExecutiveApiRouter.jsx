import { useEffect } from "react";
import api, { IS_LOCAL_API } from "../lib/api";

export default function ExecutiveApiRouter() {
  useEffect(() => {
    const interceptorId = api.interceptors.request.use((config) => {
      if (IS_LOCAL_API) return config;

      if (config.url === "/dashboard") {
        return {
          ...config,
          url: "/executive-data",
          params: { ...(config.params || {}), view: "dashboard" },
        };
      }

      if (config.url === "/reports/daily-executive") {
        return {
          ...config,
          url: "/executive-data",
          params: { ...(config.params || {}), view: "daily" },
        };
      }

      return config;
    });

    return () => api.interceptors.request.eject(interceptorId);
  }, []);

  return null;
}
