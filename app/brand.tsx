export default function Brand({title}:{title:string}) {
  return <div className="identity"><img className="brand-logo" src="/brand/terg-logo.png" alt="The Event Rental Guys" width="1233" height="434"/><div className="brand-divider"/><div><div className="brand-name">WAREHOUSE OPERATIONS</div><h1>{title}<span className="title-dot">.</span></h1></div></div>;
}
