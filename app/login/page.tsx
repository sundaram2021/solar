import { LoginArtPanel } from "@/components/login/login-art-panel";
import { LoginFormPanel } from "@/components/login/login-form-panel";

export const metadata = {
  title: "Sign in — Solar",
  description: "Connect your GitHub workspace to Solar, your autonomous software factory.",
};

export default async function LoginPage() {
  return (
    <main className="login-page">
      <LoginArtPanel />
      <LoginFormPanel />
    </main>
  );
}
