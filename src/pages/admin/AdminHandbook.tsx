import { Link } from 'react-router-dom'
import {
  FileText, Newspaper, Layers, MessageCircle, Image, Handshake,
  ListOrdered, Settings, Pencil, LifeBuoy, Blocks,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { usernameFromEmail } from '../../lib/utils'
import UserAvatar from '../../components/UserAvatar'

// A simple, friendly handbook explaining how the CMS works. Static content.
export default function AdminHandbook() {
  const { user, displayName } = useAuth()

  return (
    <div className="fade-in handbook">
      <div className="admin-page-header">
        <h1>Handbok</h1>
      </div>

      <div className="handbook-intro-row">
        {/* Samma figur som i kontomenyn — en neutral platshållarikon om
            Rögleblobbar är avstängda i inställningarna, se UserAvatar. */}
        <UserAvatar seed={user?.email ?? ''} size={64} gaze title={displayName || 'Din guide'} />
        <p className="text-muted handbook-intro" style={{ margin: 0 }}>
          Hej {displayName || (user?.email ? usernameFromEmail(user.email) : 'där')}! Välkommen! Det här är en enkel guide
          till hur webbplatsens innehåll hanteras. Du behöver inte kunna något tekniskt – allt sker genom
          att fylla i fält, ladda upp bilder och klicka på Spara. Använd menyn till vänster för att hitta rätt del.
        </p>
      </div>

      <div className="handbook-grid">
        <section className="card handbook-card">
          <h2><LifeBuoy size={20} /> Så funkar det – i korthet</h2>
          <ul>
            <li>Allt innehåll är uppdelat i <strong>sektioner</strong> i vänstermenyn.</li>
            <li>I varje sektion ser du en <strong>lista</strong> där du kan lägga till, redigera och ta bort.</li>
            <li>Klicka <strong>Spara</strong> (eller Publicera) för att ändringen ska synas på webbplatsen.</li>
            <li>Status <strong>Utkast</strong> = syns inte publikt. <strong>Publicerad</strong> = syns för besökare.</li>
            <li>Du kan alltid <strong>Förhandsgranska</strong> eller öppna den publika sidan för att se resultatet.</li>
          </ul>
        </section>

        <section className="card handbook-card">
          <h2><FileText size={20} /> Sidor</h2>
          <p>
            Under <Link to="/admin/sidor">Sidor</Link> redigerar du de fasta texterna på varje sida
            (rubrik, ingress och t.ex. rubriker för sektioner). Från varje sida finns genvägar för att
            <strong> hoppa vidare</strong> till det dynamiska innehållet (t.ex. "Hantera nyheter").
          </p>
          <p className="handbook-tip">
            Tips: På den publika webbplatsen visas en grön <Pencil size={14} className="handbook-inline-icon" /> pennknapp
            när du är inloggad – klicka på den för att hoppa direkt till redigeringen av just den sidan.
          </p>
        </section>

        <section className="card handbook-card">
          <h2><Blocks size={20} /> Bygga innehåll med block</h2>
          <p>
            Nyheter, ämnesområden, bakgrundssidan och press byggs med en <strong>blockeditor</strong>. Du
            skriver som i ett vanligt dokument – tryck <kbd>Enter</kbd> för ny rad. Markera en rad och välj
            <strong> Rubrik</strong> eller <strong>Citat</strong>, eller lägg till block som bild, faktaruta,
            punktlista, uppmaning (CTA), video och källor via knapparna i verktygsraden.
          </p>
        </section>

        <section className="card handbook-card">
          <h2><Newspaper size={20} /> Nyheter, <Layers size={16} /> Ämnen, dokument m.m.</h2>
          <ul>
            <li><strong>Nyheter</strong> – skriv inlägg med bild och text; publicera när det är klart.</li>
            <li><strong>Ämnesområden</strong> – längre artiklar. Du kan skapa nya <em>från en mall</em> för att slippa börja från tomt.</li>
            <li><strong>Dokument</strong> – ladda upp en fil (PDF, Word m.m.); filtypen känns igen automatiskt.</li>
            <li><strong>Media</strong> – bildbank; här hamnar även vittnesbilder som fått marknadsförings­samtycke.</li>
            <li><strong>Karta</strong> – lägg till punkter på kartan. <strong>Tidslinje</strong> – viktiga händelser. <strong>FAQ</strong> – frågor och svar.</li>
          </ul>
        </section>

        <section className="card handbook-card">
          <h2><MessageCircle size={20} /> Kommunikation</h2>
          <ul>
            <li><strong>Vittnesmål</strong> – granska inskickade berättelser och godkänn/avvisa dem.</li>
            <li><strong>FAQ</strong> – frågor besökare skickat in via FAQ-sidan hamnar överst som
              <strong> Obesvarade frågor</strong>, både här och under <Link to="/admin/utkast">Utkast</Link>.
              Skriv ett svar och publicera.</li>
            <li><strong>Meddelanden</strong> – meddelanden från kontaktformuläret.</li>
            <li><strong>Kontakter</strong> – kontaktpersoner som visas på kontaktsidan.</li>
            <li><strong>Sponsorer</strong> – logotyper som rullar i tickern på startsidan. Ordningen styrs med ↑/↓ (ett steg ned = ett steg åt höger).</li>
          </ul>
        </section>

        <section className="card handbook-card">
          <h2><ListOrdered size={20} /> Meny &amp; <Image size={16} /> media</h2>
          <p>
            Under <Link to="/admin/meny">Meny</Link> bygger du huvudmenyn. <strong>Dra</strong> raderna för att
            sortera, dra in ett val under ett annat för att göra det till <strong>underval</strong>, välj
            <strong> ikon</strong>, och lägg snabbt till en sida från listan över sidor som inte redan finns i menyn.
          </p>
        </section>

        <section className="card handbook-card">
          <h2><Settings size={20} /> Webbplats &amp; inställningar</h2>
          <ul>
            <li><strong>Interna dokument</strong> – en intern dokumentbank som aldrig syns publikt.</li>
            <li><strong>Inställningar</strong> – webbplatsens namn, logga, hero, kontaktuppgifter m.m. Här styr du
              också <strong>Rögleblobbar</strong>: de interaktiva figurerna kan stängas av helt, visas bara i
              adminpanelen/intranätet, eller överallt (även publikt).</li>
            <li><strong>Administratörer</strong> – tilldela roller och (som superadmin) byta lösenord åt andra
              användare, direkt i en dialogruta.</li>
          </ul>
        </section>

        <section className="card handbook-card">
          <h2><Handshake size={20} /> Behöver du hjälp?</h2>
          <p>
            Kom ihåg: du kan inte "ha sönder" något permanent – innehåll kan alltid redigeras eller sättas
            till utkast igen. Testa dig gärna fram, och spara ofta. Är du osäker, lämna innehållet som
            utkast tills det är klart.
          </p>
        </section>
      </div>
    </div>
  )
}
