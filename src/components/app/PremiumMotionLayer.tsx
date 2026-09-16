import { lazy, Suspense, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";

const Lottie = lazy(() => import("lottie-react").then((mod) => ({ default: mod.Lottie })));

const studyPulseAnimation = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 220,
  h: 220,
  nm: "Study pulse",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Orbit",
      sr: 1,
      ks: {
        o: { a: 0, k: 52 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 90, s: [360] },
          ],
        },
        p: { a: 0, k: [110, 110, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [150, 150] } },
            {
              ty: "st",
              c: { a: 0, k: [0.063, 0.725, 0.506, 1] },
              o: { a: 0, k: 80 },
              w: { a: 0, k: 6 },
              lc: 2,
              lj: 2,
            },
            { ty: "tm", s: { a: 0, k: 8 }, e: { a: 0, k: 76 }, o: { a: 0, k: 0 } },
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Core",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [110, 110, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [82, 82, 100] },
            { t: 45, s: [100, 100, 100] },
            { t: 90, s: [82, 82, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [72, 72] } },
            { ty: "fl", c: { a: 0, k: [0.863, 0.647, 0.298, 1] }, o: { a: 0, k: 92 } },
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
};

export function PremiumMotionLayer() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || !layerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(".premium-motion-drift", {
        x: "random(-18, 18)",
        y: "random(-14, 14)",
        scale: "random(0.95, 1.08)",
        duration: 7,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.7,
      });
    }, layerRef);

    return () => ctx.revert();
  }, [reduceMotion]);

  return (
    <div
      ref={layerRef}
      className="premium-motion-layer pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="premium-motion-drift absolute left-[6%] top-[12%] h-28 w-80 rotate-[-10deg] rounded-2xl bg-emerald-500/8 blur-3xl" />
      <div className="premium-motion-drift absolute right-[8%] top-[18%] h-24 w-72 rotate-[12deg] rounded-2xl bg-amber-500/8 blur-3xl" />
      <div className="premium-motion-drift absolute bottom-[8%] left-[30%] h-28 w-96 rotate-[4deg] rounded-2xl bg-sky-500/7 blur-3xl" />
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 0.26, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="absolute right-4 top-20 hidden size-36 md:block"
      >
        <Suspense fallback={null}>
          <Lottie
            src={studyPulseAnimation}
            loop
            autoplay
            rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
          />
        </Suspense>
      </motion.div>
    </div>
  );
}
