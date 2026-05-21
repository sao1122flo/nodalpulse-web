import type { Metadata } from "next"
import { LegalShell } from "@/components/LegalShell"

export const metadata: Metadata = {
  title: "Privacy Policy — NodalPulse",
  description:
    "NodalPulse Privacy Policy. How we collect, use, and protect your information. Effective May 20, 2026.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://nodalpulse.com/privacy" },
}

export default function PrivacyPage() {
  return (
    <LegalShell>
      <h1>Privacy Policy</h1>
      <p className="legal-meta">
        <strong>Effective date:</strong> May 20, 2026 &nbsp;·&nbsp;{" "}
        <strong>Last updated:</strong> May 20, 2026
      </p>
      <p>
        This Privacy Policy explains how <strong>Cordillera Ventures LLC</strong>, a Wyoming limited
        liability company, operator of the NodalPulse software-as-a-service product (collectively,
        &ldquo;<strong>NodalPulse</strong>,&rdquo; &ldquo;<strong>we</strong>,&rdquo;
        &ldquo;<strong>us</strong>,&rdquo; or &ldquo;<strong>our</strong>&rdquo;), collects, uses,
        shares, and protects information about you when you use the website at{" "}
        <code>nodalpulse.com</code> and <code>app.nodalpulse.com</code> (the &ldquo;
        <strong>Site</strong>&rdquo;) and the NodalPulse subscription service (the &ldquo;
        <strong>Service</strong>&rdquo;). It is incorporated into our{" "}
        <a href="/terms">Terms of Service</a>. &ldquo;<strong>NodalPulse</strong>&rdquo; is a
        product and trade name of Cordillera Ventures LLC; the data controller in all cases is
        Cordillera Ventures LLC.
      </p>
      <p>
        If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana,
        Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon,
        Rhode Island, Tennessee, Texas, Utah, or Virginia (or any other U.S. state with a
        comprehensive privacy law in effect when you read this), additional rights apply. See{" "}
        <strong>Section 10</strong>.
      </p>
      <p>
        If you are in the European Economic Area, the United Kingdom, or Switzerland, additional
        rights apply. See <strong>Section 11</strong>.
      </p>

      <hr />

      {/* 1 */}
      <h2>1. Quick summary (non-binding)</h2>
      <p>
        This summary is provided for convenience. The detailed sections that follow govern in case
        of any conflict.
      </p>
      <ul>
        <li>
          <strong>We collect</strong> the account information you give us, the content you submit
          (market roles, tracked dockets, saved searches, Q&amp;A questions), billing data through
          Stripe, and technical data (IP address, device, usage).
        </li>
        <li>
          <strong>We use it</strong> to deliver the Service, bill you, support you, improve the
          Service, send transactional and limited marketing email, and comply with law.
        </li>
        <li>
          <strong>We share it</strong> only with a short list of named service providers (Stripe,
          Anthropic, Brevo, Cloudflare, Railway, Google, Microsoft), with authorities when required
          by law, and in a corporate transaction.
        </li>
        <li>
          <strong>We do not sell your personal information</strong> and we do not engage in
          cross-context behavioral advertising.
        </li>
        <li>
          <strong>We retain it</strong> for as long as your account is active and up to ninety (90)
          days after deletion, longer where required by law (e.g., tax records for seven (7) years).
        </li>
        <li>
          <strong>You have rights</strong> to access, correct, delete, port, and object. Contact{" "}
          <code>support@nodalpulse.com</code>.
        </li>
        <li>
          <strong>AI processing.</strong> When you use the Service, your inputs are sent to
          Anthropic&rsquo;s Claude API for processing. We do not use your Customer Data to train AI
          models, and we contractually require Anthropic not to use it to train theirs.
        </li>
      </ul>

      <hr />

      {/* 2 */}
      <h2>2. Who is the data controller?</h2>
      <p>
        For purposes of GDPR and UK GDPR, Cordillera Ventures LLC (operating the NodalPulse
        service) is the data controller of the personal data we collect about you. Our address and
        contact information are at the bottom of this Policy.
      </p>
      <p>
        We do not currently maintain a representative in the European Union or the United Kingdom
        under Article 27 GDPR or its UK equivalent, because at the time of this Policy our scale of
        EU/UK processing falls below the thresholds at which appointment is required. If that
        changes, we will update this Policy.
      </p>

      {/* 3 */}
      <h2>3. Information we collect</h2>

      <h3>3.1 Information you give us directly</h3>
      <ul>
        <li>
          <strong>Account information.</strong> Your name, work email, work organization (optional),
          market roles, tracked markets, tracked dockets, saved searches, and your OAuth identifier
          when you sign in through Google or Microsoft.
        </li>
        <li>
          <strong>Billing information.</strong> When you subscribe to a paid plan, you provide
          payment information to Stripe directly. We do not see or store full card numbers. We do
          store your customer ID with Stripe, subscription status, plan tier, billing email, and the
          last four digits and brand of your default card (as returned by Stripe).
        </li>
        <li>
          <strong>Support and communications.</strong> Messages you send to{" "}
          <code>support@nodalpulse.com</code>, feedback you submit through in-app forms, and any
          documents you choose to attach.
        </li>
        <li>
          <strong>Content and queries.</strong> The questions you ask in Q&amp;A Chat, the saved
          searches you create, the dockets you track, and any documents you upload.
        </li>
      </ul>

      <h3>3.2 Information we collect automatically</h3>
      <ul>
        <li>
          <strong>Usage data.</strong> Pages you view, features you use, the time and duration of
          sessions, the briefs we deliver to you, the Q&amp;A queries you submit, and similar
          interaction telemetry.
        </li>
        <li>
          <strong>Device and technical data.</strong> IP address, browser type, operating system,
          screen size, language, referring URL, and timestamps.
        </li>
        <li>
          <strong>Cookies and similar technologies.</strong> We use a small number of strictly
          necessary cookies for authentication, session management, and security (CSRF protection).
          We do not use advertising cookies or third-party tracking cookies, and we do not engage in
          cross-context behavioral advertising. If we add a privacy-respecting analytics product in
          the future (for example, a self-hosted or cookie-less alternative), we will update this
          section and provide a cookie banner if applicable law requires one.
        </li>
      </ul>

      <h3>3.3 Information from third parties</h3>
      <ul>
        <li>
          <strong>OAuth providers.</strong> When you sign in through Google or Microsoft, we receive
          your name, email address, and a stable account identifier from the provider. We request
          only the <code>openid</code>, <code>email</code>, and <code>profile</code> scopes. We do
          not request access to your calendar, mail, drive, contacts, or any other resource.
        </li>
        <li>
          <strong>Payment processor.</strong> Stripe shares with us limited billing metadata as
          described in <strong>Section 3.1</strong>.
        </li>
        <li>
          <strong>Public-source content.</strong> The Service ingests public regulatory filings and
          market notices from sources such as the Public Utility Commission of Texas (PUCT)
          Interchange Filing System and the Electric Reliability Council of Texas (ERCOT) Market
          Information System. These filings sometimes contain personal data about filers, parties,
          and counsel (their names, affiliations, and contact information). We process that personal
          data solely to provide the Service.
        </li>
      </ul>

      <h3>3.4 Categories under CCPA/CPRA</h3>
      <p>
        For California residents, the categories of personal information we collect, as defined
        under the California Consumer Privacy Act as amended by the California Privacy Rights Act
        (&ldquo;<strong>CCPA/CPRA</strong>&rdquo;), include: identifiers (name, email, IP address,
        OAuth identifier); commercial information (subscription and billing metadata); internet or
        network activity information (usage telemetry); inferences (derived attributes such as your
        role and tracked markets, used to personalize briefs). We do not collect sensitive personal
        information as defined under CCPA/CPRA (we do not collect your government identifiers,
        financial account credentials, health, geolocation precise to within 1,850 feet, or content
        of mail/email/text messages other than those you send to support).
      </p>

      {/* 4 */}
      <h2>4. How we use information</h2>
      <p>We use the information described above for the following purposes:</p>
      <p>
        (a) <strong>To provide and operate the Service:</strong> authenticate you, deliver Morning
        Briefs, fire saved searches, answer Q&amp;A questions, render dashboards, send transactional
        email, store your settings and content.
      </p>
      <p>
        (b) <strong>To bill you and process payments:</strong> through Stripe.
      </p>
      <p>
        (c) <strong>To support you:</strong> respond to your questions, troubleshoot, and notify you
        of service-affecting issues.
      </p>
      <p>
        (d) <strong>To improve the Service:</strong> understand which features are used, measure
        performance, debug errors, evaluate AI output quality, and develop new features. Where we
        use Customer Data for this purpose, we use it in aggregated or de-identified form whenever
        practical.
      </p>
      <p>
        (e) <strong>To communicate about the Service:</strong> product announcements, security
        notices, billing reminders, and (where permitted) limited marketing communications. You can
        opt out of marketing email at any time.
      </p>
      <p>
        (f) <strong>To enforce our <a href="/terms">Terms of Service</a> and protect the Service:</strong>{" "}
        detect fraud, abuse, account compromise, and violations.
      </p>
      <p>
        (g) <strong>To comply with law:</strong> respond to lawful requests from authorities,
        preserve records, and meet our tax and accounting obligations.
      </p>

      <h3>4.1 Legal bases (GDPR / UK GDPR)</h3>
      <p>
        If you are in the EEA, the UK, or Switzerland, we rely on the following legal bases under
        Article 6(1) GDPR:
      </p>
      <ul>
        <li>
          <strong>Performance of a contract</strong> (Art. 6(1)(b)) for processing necessary to
          deliver the Service you have asked us to provide.
        </li>
        <li>
          <strong>Legitimate interests</strong> (Art. 6(1)(f)) for processing to improve and secure
          the Service, prevent fraud, and send limited service-related communications. We balance
          our interests against your rights and only rely on this basis where our interests are not
          overridden.
        </li>
        <li>
          <strong>Compliance with a legal obligation</strong> (Art. 6(1)(c)) for tax, accounting,
          anti-fraud, and lawful-disclosure obligations.
        </li>
        <li>
          <strong>Consent</strong> (Art. 6(1)(a)) for any processing that requires it, such as
          certain marketing communications. You may withdraw consent at any time without affecting
          the lawfulness of processing before withdrawal.
        </li>
      </ul>
      <p>We do not currently process special-category personal data under Article 9 GDPR.</p>

      {/* 5 */}
      <h2>5. Who we share information with</h2>
      <p>
        We share personal information with the limited set of categories of recipients below. Each
        is bound by a written contract restricting its use of the personal information.
      </p>

      <h3>5.1 Subprocessors</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Subprocessor</th>
            <th scope="col">Purpose</th>
            <th scope="col">Data categories</th>
            <th scope="col">Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Stripe, Inc.</strong></td>
            <td>Payment processing, subscription management, billing</td>
            <td>Billing information, customer ID, plan + subscription state</td>
            <td>United States</td>
          </tr>
          <tr>
            <td><strong>Anthropic, PBC</strong></td>
            <td>
              Large-language-model inference for Morning Briefs, Q&amp;A responses, and filing
              summaries (Claude API)
            </td>
            <td>
              Customer queries, filing text we send for summarization, and limited account context
            </td>
            <td>United States</td>
          </tr>
          <tr>
            <td><strong>Sendinblue SAS d/b/a Brevo</strong></td>
            <td>
              Transactional email delivery (Morning Briefs, account notices, password resets)
            </td>
            <td>Email address, name, message content</td>
            <td>European Union (France)</td>
          </tr>
          <tr>
            <td><strong>Cloudflare, Inc.</strong></td>
            <td>
              Content delivery network, DNS, DDoS protection, email routing for{" "}
              <code>@nodalpulse.com</code> mailboxes
            </td>
            <td>IP address, request metadata, message envelopes</td>
            <td>Global edge network with U.S. headquarters</td>
          </tr>
          <tr>
            <td><strong>Railway Corp.</strong></td>
            <td>Application hosting, managed Postgres database</td>
            <td>All Customer Data processed by the Service</td>
            <td>United States</td>
          </tr>
          <tr>
            <td><strong>Google LLC</strong></td>
            <td>OAuth sign-in (Google Sign-In)</td>
            <td>OAuth identifier, name, email, profile</td>
            <td>United States</td>
          </tr>
          <tr>
            <td><strong>Microsoft Corporation</strong></td>
            <td>OAuth sign-in (Microsoft Identity Platform)</td>
            <td>OAuth identifier, name, email, profile</td>
            <td>United States</td>
          </tr>
        </tbody>
      </table>
      <p>
        This list reflects our current subprocessors. We will update this list before engaging a
        new subprocessor that materially expands the scope of data sharing, and customers may
        subscribe to subprocessor-change notifications by emailing{" "}
        <code>support@nodalpulse.com</code>.
      </p>

      <h3>5.2 Use of Anthropic and AI inputs</h3>
      <p>
        The Service sends user queries, filing excerpts, and limited account context to Anthropic
        for LLM inference. We use Anthropic&rsquo;s commercial API. Under Anthropic&rsquo;s
        commercial API terms in effect at the time of this Policy, inputs and outputs are not used
        to train Anthropic&rsquo;s models. If those terms change in a way that materially affects
        this commitment, we will update this Policy.
      </p>
      <p>We do not use Customer Data to train AI models of our own.</p>

      <h3>5.3 Legal compliance and protection</h3>
      <p>
        We may disclose personal information to a court, regulator, or law-enforcement authority
        where we believe in good faith that disclosure is required by applicable law, a valid legal
        process, or a binding governmental request. We may also disclose where necessary to protect
        our rights or property, our users&rsquo; safety, or the public.
      </p>

      <h3>5.4 Corporate transactions</h3>
      <p>
        If we are involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale
        of assets, personal information may be transferred as part of that transaction. We will give
        you reasonable notice (for example, by email and a notice on the Site) before personal
        information becomes subject to a different privacy policy.
      </p>

      <h3>5.5 Aggregated and de-identified data</h3>
      <p>
        We may share aggregated or de-identified information (which cannot reasonably be used to
        identify you) for research, benchmarking, or marketing.
      </p>

      <h3>5.6 No sale; no cross-context behavioral advertising</h3>
      <p>
        We do not sell personal information for monetary or other valuable consideration, and we do
        not engage in cross-context behavioral advertising or &ldquo;share&rdquo; personal
        information for such purposes, as those terms are defined under CCPA/CPRA and similar state
        laws.
      </p>

      {/* 6 */}
      <h2>6. International data transfers</h2>
      <p>
        NodalPulse is established in the United States, and most of our subprocessors operate from
        the United States. When we transfer personal data of EEA, UK, or Swiss data subjects to the
        United States or to other countries that are not subject to an adequacy decision, we rely on
        the European Commission&rsquo;s Standard Contractual Clauses (SCCs) (Implementing Decision
        (EU) 2021/914), the UK International Data Transfer Addendum, or, where applicable, the
        EU-U.S. Data Privacy Framework and its UK and Swiss extensions. Copies of the relevant
        transfer mechanisms are available on request to <code>support@nodalpulse.com</code>.
      </p>

      {/* 7 */}
      <h2>7. How we secure information</h2>
      <p>
        We use commercially reasonable administrative, technical, and physical safeguards to protect
        personal information, including TLS in transit, encryption of data at rest in our managed
        database, secret rotation, least-privilege access controls for our team, and routine
        security review of our subprocessors. No system is perfectly secure, however, and we do not
        warrant that personal information will never be accessed by unauthorized persons. If we
        become aware of a breach that affects your personal information and that triggers a
        notification obligation under applicable law, we will notify you and any required authority
        within the applicable statutory deadline.
      </p>
      <p>
        You play a role in security too: use a strong, unique password (or use Google/Microsoft
        sign-in), do not share your account credentials, and report suspected unauthorized access to{" "}
        <code>support@nodalpulse.com</code>.
      </p>

      {/* 8 */}
      <h2>8. How long we keep information</h2>
      <p>
        We retain personal information for as long as your account is active and as needed to
        provide the Service. When you delete your account, we delete personal information from our
        active production systems within ninety (90) days, except for:
      </p>
      <ul>
        <li>
          Records we are required to retain by law (for example, tax and accounting records, which
          U.S. law generally requires for seven (7) years);
        </li>
        <li>
          Limited information necessary to enforce our <a href="/terms">Terms of Service</a>,
          resolve disputes, or prevent fraud or abuse (for example, a hash of a disputed
          account&rsquo;s email);
        </li>
        <li>
          Backup archives, from which records are purged on the rolling schedule of each backup
          system; and
        </li>
        <li>Aggregated or de-identified information.</li>
      </ul>
      <p>
        If you request deletion under a statutory right described in <strong>Section 10</strong> or{" "}
        <strong>Section 11</strong>, we will process the request on the timelines required by the
        applicable law.
      </p>

      {/* 9 */}
      <h2>9. Children</h2>
      <p>
        The Service is not directed to children under 18, and we do not knowingly collect personal
        information from children under 18. If we learn we have collected personal information from
        a child under 18 without parent or guardian consent, we will delete it. Contact{" "}
        <code>support@nodalpulse.com</code> if you believe a child has provided us personal
        information.
      </p>

      {/* 10 */}
      <h2>10. Rights of U.S. state residents</h2>
      <p>
        The privacy laws of an expanding list of U.S. states give you rights regarding the personal
        information businesses hold about you. The rights below apply to residents of California,
        Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota,
        Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah,
        and Virginia, and to residents of any other state with a comprehensive consumer privacy law
        in effect at the time of your request. We honor verifiable consumer requests up to the
        maximum scope permitted by the applicable law.
      </p>

      <h3>10.1 Rights summary</h3>
      <ul>
        <li>
          <strong>Right to know / access.</strong> Request the categories and specific pieces of
          personal information we have collected about you.
        </li>
        <li>
          <strong>Right to correct.</strong> Request that we correct inaccurate personal
          information.
        </li>
        <li>
          <strong>Right to delete.</strong> Request that we delete personal information about you,
          subject to permitted exceptions.
        </li>
        <li>
          <strong>Right to portability.</strong> Request a copy of personal information in a
          portable, structured, machine-readable format.
        </li>
        <li>
          <strong>Right to opt out of sale and of &ldquo;sharing&rdquo;</strong> (cross-context
          behavioral advertising). We do not engage in either; the opt-out is effectively a no-op
          for us.
        </li>
        <li>
          <strong>Right to opt out of targeted advertising and certain profiling.</strong> We do not
          engage in targeted advertising and do not currently use automated decision-making with
          legal or similarly significant effects.
        </li>
        <li>
          <strong>Right to limit use of sensitive personal information</strong> (California). We do
          not collect sensitive personal information as defined under CCPA/CPRA.
        </li>
        <li>
          <strong>Right against retaliation.</strong> We will not deny service, charge different
          prices, or provide a different level of service because you exercised a privacy right
          (subject to permitted financial incentives and bona fide loyalty programs, neither of
          which we currently offer).
        </li>
      </ul>

      <h3>10.2 How to exercise</h3>
      <p>
        Send a request to <code>support@nodalpulse.com</code> with &ldquo;Privacy Request&rdquo; in
        the subject line and describe the right you wish to exercise. We may need to verify your
        identity, typically by confirming you control the email address associated with your
        account; for sensitive requests we may ask for additional verification proportional to the
        sensitivity of the data.
      </p>
      <p>
        You may use an authorized agent to make a request on your behalf, where applicable law
        allows. We will require evidence of the agent&rsquo;s authorization.
      </p>

      <h3>10.3 Timing</h3>
      <p>
        We will respond to your request within the time required by applicable law (typically 45
        days, extendable in limited cases).
      </p>

      <h3>10.4 Appeals (Virginia, Colorado, Connecticut, and others)</h3>
      <p>
        If we decline your request, you may appeal by replying to our response with
        &ldquo;Appeal&rdquo; in the subject line. If we deny your appeal, you may contact the
        attorney general of your state.
      </p>

      {/* 11 */}
      <h2>11. Rights of EEA, UK, and Swiss data subjects</h2>
      <p>
        If you are in the European Economic Area, the United Kingdom, or Switzerland, you have the
        following rights under the GDPR (or the UK GDPR or Swiss FADP, as applicable):
      </p>
      <ul>
        <li>
          <strong>Access</strong> &mdash; confirmation of whether we process your personal data
          and, if so, a copy.
        </li>
        <li>
          <strong>Rectification</strong> &mdash; correction of inaccurate or incomplete personal
          data.
        </li>
        <li>
          <strong>Erasure</strong> (the &ldquo;right to be forgotten&rdquo;) &mdash; deletion of
          personal data in defined circumstances.
        </li>
        <li>
          <strong>Restriction of processing</strong> &mdash; in defined circumstances.
        </li>
        <li>
          <strong>Data portability</strong> &mdash; receipt of personal data you provided in a
          structured, commonly used, machine-readable format.
        </li>
        <li>
          <strong>Objection</strong> &mdash; including objection to processing based on our
          legitimate interests, and objection to direct marketing at any time.
        </li>
        <li>
          <strong>Withdrawal of consent</strong> &mdash; where processing is based on consent.
        </li>
        <li>
          <strong>Lodging a complaint</strong> &mdash; with a supervisory authority in your country
          of residence or place of work, or with the country where the alleged infringement
          occurred. A list of EEA supervisory authorities is available at{" "}
          <a
            href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
            target="_blank"
            rel="noopener noreferrer"
          >
            edpb.europa.eu
          </a>
          . UK residents may contact the Information Commissioner&rsquo;s Office at{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">
            ico.org.uk
          </a>
          .
        </li>
      </ul>
      <p>
        To exercise any of these rights, email <code>support@nodalpulse.com</code>. We will respond
        within one month of receipt, extendable by up to two months for complex requests, in which
        case we will tell you about the extension and the reasons for it.
      </p>
      <p>
        We do not currently make solely automated decisions that produce legal or similarly
        significant effects about you.
      </p>

      {/* 12 */}
      <h2>12. Do Not Track and Global Privacy Control</h2>
      <p>
        Some browsers send &ldquo;Do Not Track&rdquo; signals. Because there is no industry
        standard for how to respond to these signals, we do not currently respond to them. However,
        we will recognize the Global Privacy Control (GPC) signal sent by certain browsers as a
        valid opt-out of &ldquo;sale&rdquo; and &ldquo;sharing&rdquo; of personal information for
        residents of states whose laws require us to do so. As stated above, we do not sell or
        &ldquo;share&rdquo; personal information in the relevant sense, but we will treat a GPC
        signal as a confirmation of that status for your browser.
      </p>

      {/* 13 */}
      <h2>13. Changes to this Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material changes, we will
        notify you by email to the address on your account or by a prominent notice on the Site at
        least fifteen (15) days before the change takes effect, except where applicable law requires
        a shorter or longer notice period. The &ldquo;Last updated&rdquo; date at the top of this
        Policy indicates when it was most recently revised.
      </p>

      {/* 14 */}
      <h2>14. How to contact us</h2>
      <p>Privacy questions, requests, and complaints can be sent to:</p>
      <p>
        <strong>Cordillera Ventures LLC</strong>
        <br />
        A Wyoming limited liability company, operator of the NodalPulse service
        <br />
        <a href="mailto:support@nodalpulse.com">support@nodalpulse.com</a>
        <br />
        <a href="https://nodalpulse.com" target="_blank" rel="noopener noreferrer">
          nodalpulse.com
        </a>
      </p>
      <p>
        Please put &ldquo;Privacy Request&rdquo; in the subject line for data-rights requests and
        &ldquo;Privacy Question&rdquo; for general inquiries; we triage on subject line.
      </p>
    </LegalShell>
  )
}
