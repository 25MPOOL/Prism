interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { children } = props;

  return (
    <div className="flex flex-col min-h-full w-full">
      <header className="h-16 w-full bg-[#151b23]">header</header>
      <main className="grow">{children}</main>
    </div>
  );
};
