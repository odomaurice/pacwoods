"use client";

import { Button } from "@/components/ui/button";

/** Back to the page that could not be opened (only a path on this site). */
function wanted() {
  const from = new URLSearchParams(location.search).get("from");
  return from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
}

export default function TryAgain() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button variant="onDark" size="lg" onClick={() => history.back()}>
        Go back
      </Button>
      <Button variant="gold" size="lg" onClick={() => location.assign(wanted())}>
        Try again
      </Button>
    </div>
  );
}
