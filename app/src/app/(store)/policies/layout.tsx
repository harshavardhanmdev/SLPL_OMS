export default function PoliciesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <article className="prose-slpl space-y-5 [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
        {children}
      </article>
    </div>
  );
}
