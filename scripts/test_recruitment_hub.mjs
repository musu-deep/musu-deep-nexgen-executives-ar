import assert from "node:assert/strict";
import {
  addRecruitmentCandidate,
  createRecruitmentJob,
  getPublicRecruitmentJob,
  publicJobHtml,
  publishRecruitmentJob,
  recruitmentDashboard,
} from "../lib/araak-recruitment.js";

const actor = { id: "usr_admin", name: "مدير النظام", role: "admin" };
const job = await createRecruitmentJob({
  title: "مدير تطوير أعمال",
  department: "التنمية",
  location: "الرياض",
  description: "قيادة تطوير الأعمال والشراكات.",
  required_skills: ["المبيعات", "الشراكات", "التفاوض"],
  preferred_skills: ["التحليل"],
  min_experience: 5,
  required_education: "bachelor",
  channels: ["google_jobs", "linkedin", "indeed"],
}, actor);

await addRecruitmentCandidate({
  job_id: job.id,
  name: "مرشح الاختبار الأول",
  email: "candidate1@example.com",
  experience_years: 7,
  education_level: "master",
  skills: ["المبيعات", "الشراكات", "التفاوض", "التحليل"],
  sector_fit_score: 90,
  interview_score: 88,
  values_score: 92,
  availability_score: 80,
}, actor);

await addRecruitmentCandidate({
  job_id: job.id,
  name: "مرشح الاختبار الثاني",
  email: "candidate2@example.com",
  experience_years: 3,
  education_level: "bachelor",
  skills: ["المبيعات"],
  sector_fit_score: 65,
  interview_score: 70,
  values_score: 75,
  availability_score: 95,
}, actor);

const published = await publishRecruitmentJob(job.id, { channels: job.channels }, actor);
assert.equal(published.job.status, "published");
assert.equal(published.plan.length, 3);

const dashboard = await recruitmentDashboard(actor);
const rankedJob = dashboard.jobs.find((item) => item.id === job.id);
assert.equal(rankedJob.ranking.length, 2);
assert.equal(rankedJob.ranking[0].name, "مرشح الاختبار الأول");
assert.ok(rankedJob.ranking[0].score.total > rankedJob.ranking[1].score.total);
assert.equal(rankedJob.recommendation.candidate_name, "مرشح الاختبار الأول");

const publicJob = await getPublicRecruitmentJob(job.id);
const html = publicJobHtml(publicJob, "https://example.com");
assert.match(html, /JobPosting/);
assert.match(html, /مدير تطوير أعمال/);
assert.match(html, /\/api\/recruitment/);

console.log("Recruitment hub test passed", {
  job: rankedJob.title,
  top_candidate: rankedJob.recommendation.candidate_name,
  score: rankedJob.recommendation.score,
});
