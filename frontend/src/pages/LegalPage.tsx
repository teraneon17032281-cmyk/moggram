import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';

const CONTENT = {
  terms: { title: 'Terms of Service', body: 'Placeholder terms for MogGram. Replace this page with your real Terms of Service before launching.' },
  privacy: { title: 'Privacy Policy', body: 'Placeholder policy for MogGram. Replace this page with your real Privacy Policy before launching.' },
};

export default function LegalPage({ kind }: { kind: keyof typeof CONTENT }) {
  const { title, body } = CONTENT[kind];
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Logo />
      <h1 className="mt-10 text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-4 leading-relaxed text-muted">{body}</p>
      <Link to="/register" className="mt-8 inline-block text-sm font-medium text-brand hover:text-brand-hover">Back to sign up</Link>
    </div>
  );
}
