import { StaticPage } from "@/components/StaticPage";
import { BirthdayCarousel } from "@/components/BirthdayCarousel";
import "@/components/birthday-carousel.css";

export default function ActualitesPage() {
  return (
    <>
      <StaticPage filename="actualites.html" />
      <div className="wrap">
        <BirthdayCarousel />
      </div>
    </>
  );
}
