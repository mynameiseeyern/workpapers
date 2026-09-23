import { APP_VERSION } from "../version";
import { Alert, Button, Card, Form, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { pb } from "../data/pb";

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true); setError(null);
    try {
      await pb.collection("users").authWithPassword(email, password);
      onSignedIn();
    } catch {
      setError("That email and password don't match. Try again.");
    } finally { setPending(false); }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <Card.Header>
          <Card.Title>Workpapers</Card.Title>
          <Card.Description>Sign in to the household workpapers.</Card.Description>
        </Card.Header>
        <Card.Content>
          <Form className="flex flex-col gap-4" onSubmit={submit}>
            <TextField isRequired type="email" value={email} onChange={setEmail} autoComplete="username">
              <Label>Email</Label>
              <Input />
            </TextField>
            <TextField isRequired type="password" value={password} onChange={setPassword} autoComplete="current-password">
              <Label>Password</Label>
              <Input />
            </TextField>
            {error && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
              </Alert>
            )}
            <Button type="submit" variant="primary" isPending={pending} fullWidth>Sign in</Button>
          </Form>
        </Card.Content>
      </Card>
      <p className="mt-3 text-center text-[11px] text-muted">Version {APP_VERSION}</p>
    </main>
  );
}
