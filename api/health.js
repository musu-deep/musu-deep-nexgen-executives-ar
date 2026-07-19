export default function handler(request, response) {
  response.status(200).json({
    status: "ready",
    service: "NEXGEN EXECUTIVES",
    runtime: "vercel-node",
  });
}
