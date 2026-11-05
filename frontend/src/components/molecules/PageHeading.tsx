type PageHeadingProps = {
  eyebrow: string;
  title: string;
};

export function PageHeading({ eyebrow, title }: PageHeadingProps) {
  return <div className="page-heading">
    <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
  </div>;
}
