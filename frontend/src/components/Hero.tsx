import './Hero.css';

interface HeroProps {
  onFindMatch: () => void;
}

export default function Hero({ onFindMatch }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-background"></div>

      <div className="hero-content">
        <h1 className="hero-title">
          <span className="title-text">STAN</span>
          <span className="title-highlight">D</span>
          <span className="title-text">OFF 2</span>

          <div className="glitch-layer">
            <span className="title-text">STAN</span>
            <span className="title-highlight">D</span>
            <span className="title-text">OFF 2</span>
          </div>
        </h1>

        <h2 className="hero-subtitle">TOURNAMENT HUB</h2>

        <button className="find-match-btn" onClick={onFindMatch}>
          <span>ENTER LOBBY</span>
        </button>
      </div>
    </section>
  );
}

