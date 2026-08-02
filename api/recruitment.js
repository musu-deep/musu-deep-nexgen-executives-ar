import { currentPasswordDirectoryUser } from "../lib/araak-password-directory.js";
import {
  addRecruitmentCandidate,
  createRecruitmentJob,
  deleteRecruitmentCandidate,
  getPublicRecruitmentJob,
  publicJobHtml,
  publicRecruitmentApply,
  publishRecruitmentJob,
  recruitmentApiError,
  recruitmentDashboard,
  updateRecruitmentCandidate,
  updateRecruitmentJob,
} from "../lib/araak-recruitment.js";

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function send(response, status, payload) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(payload);
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") return send(response, 200, { ok: true });

  try {
    const publicJobId = String(request.query?.public_job_id || "").trim();
    if (request.method === "GET" && publicJobId) {
      const job = await getPublicRecruitmentJob(publicJobId);
      if (String(request.query?.format || "").toLowerCase() === "html") {
        const host = request.headers["x-forwarded-host"] || request.headers.host || "";
        const protocol = request.headers["x-forwarded-proto"] || "https";
        response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        return response.status(200).send(publicJobHtml(job, `${protocol}://${host}`));
      }
      return send(response, 200, job);
    }

    const payload = bodyOf(request);
    if (request.method === "POST" && payload.action === "public_apply") {
      return send(response, 201, await publicRecruitmentApply(payload));
    }

    const actor = await currentPasswordDirectoryUser(request);
    if (!actor) return send(response, 401, { detail: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى." });

    if (request.method === "GET") {
      return send(response, 200, await recruitmentDashboard(actor));
    }

    if (request.method === "POST") {
      switch (payload.action) {
        case "create_job":
          return send(response, 201, await createRecruitmentJob(payload.job || payload, actor));
        case "update_job":
          return send(response, 200, await updateRecruitmentJob(payload.job_id, payload.job || payload, actor));
        case "publish_job":
          return send(response, 200, await publishRecruitmentJob(payload.job_id, payload, actor));
        case "add_candidate":
          return send(response, 201, await addRecruitmentCandidate(payload.candidate || payload, actor));
        case "update_candidate":
          return send(response, 200, await updateRecruitmentCandidate(payload.candidate_id, payload.candidate || payload, actor));
        case "delete_candidate":
          return send(response, 200, await deleteRecruitmentCandidate(payload.candidate_id, actor));
        default:
          return send(response, 422, { detail: "حدد عملية صحيحة لمركز التوظيف." });
      }
    }

    return send(response, 405, { detail: "Method not allowed" });
  } catch (error) {
    const failure = recruitmentApiError(error);
    return send(response, failure.status, { detail: failure.detail });
  }
}
