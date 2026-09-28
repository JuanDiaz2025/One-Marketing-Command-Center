export function GET() {
  return Response.json({
    message: "Hello from iHackathon!",
    time: new Date().toISOString(),
  });
}
