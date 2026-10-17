import React from "react";
import Image from "next/image";
import Link from "next/link";
import { SolarMark } from "@/components/common/solar-mark";

export function LoginArtPanel() {
  return (
    <section className="login-art">
      <Image
        className="mist-image"
        src="/solar-mist.jpg"
        alt="A cable car traveling through alpine mist"
        fill
        priority
      />
      <div className="photo-wash" />

      <Link className="brand" href="/">
        <SolarMark />
        <span>Solar</span>
      </Link>

      <blockquote>
        One team.
        <br />
        Every repository.
        <br />
        Infinite possibilities.
        <p>Your code. Your context. Your Solar.</p>
      </blockquote>

      <span className="mono">A LITTLE LESS MANAGING. A LOT MORE SHIPPING.</span>
    </section>
  );
}
