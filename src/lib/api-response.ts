// Shared helpers for API route responses. Keeping the envelope shape in
// one place — `{ error: string }` on failure — lets clients parse every
// error response the same way regardless of which route produced it.
// The client forms in `src/components/InquiryForm.tsx` and
// `src/components/QuestionnaireForm.tsx` both rely on this contract.

export function apiError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}
