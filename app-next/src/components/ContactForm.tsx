"use client";

import { useState } from "react";

const CONTACT_EMAIL = "contact@planete-hmi.com";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const subject = String(form.get("subject") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const body = [`Nom : ${name}`, `E-mail : ${email}`, "", message].join("\n");

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[Planète HMI] ${subject}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label><span>Nom</span><input name="name" type="text" autoComplete="name" required maxLength={120} /></label>
      <label><span>Adresse e-mail</span><input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>
        <span>Sujet</span>
        <select name="subject" defaultValue="Question générale">
          <option>Question générale</option><option>Fiche artiste ou correction</option><option>Classement ou données</option><option>Partenariat ou média</option><option>Signalement de contenu</option><option>Autre demande</option>
        </select>
      </label>
      <label><span>Votre message</span><textarea name="message" rows={6} required maxLength={3000} /></label>
      <button className="btn btn-primary" type="submit">Préparer mon e-mail</button>
      {sent ? <p className="contact-form__notice" role="status">Votre logiciel de messagerie va s’ouvrir. Sinon, écrivez-nous à {CONTACT_EMAIL}.</p> : null}
    </form>
  );
}
