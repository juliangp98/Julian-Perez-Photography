import LoadingScreen from "@/components/ui/LoadingScreen";

// Root Suspense fallback for the App Router. Shown only while a route segment is
// actually waiting (the dynamic admin/portal reads, a cold Sanity fetch);
// instant and prerendered navigations never flash it. One loading identity for
// the whole site — segment-level skeletons fall through to this.
export default function Loading() {
  return <LoadingScreen />;
}
