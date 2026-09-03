import { ThemeProvider as NextThemesProvider } from "@teispace/next-themes";

export { useTheme } from "@teispace/next-themes";

export function ThemeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
