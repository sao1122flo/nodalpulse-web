import type { Metadata } from "next"
import { LegalShell } from "@/components/LegalShell"

export const metadata: Metadata = {
  title: "Terms of Service — NodalPulse",
  description:
    "NodalPulse Terms of Service. Governing law: Wyoming. Effective May 20, 2026.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://nodalpulse.com/terms" },
}

export default function TermsPage() {
  return (
    <LegalShell>
      <h1>Terms of Service</h1>
      <p className="legal-meta">
        <strong>Effective date:</strong> May 20, 2026 &nbsp;·&nbsp;{" "}
        <strong>Last updated:</strong> May 20, 2026
      </p>

      <hr />

      {/* 1 */}
      <h2>1. Acceptance of these Terms</h2>
      <p>
        These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) are a binding legal agreement
        between you (&ldquo;<strong>Customer</strong>,&rdquo; &ldquo;<strong>you</strong>,&rdquo; or
        &ldquo;<strong>your</strong>&rdquo;) and <strong>Cordillera Ventures LLC</strong>, a Wyoming
        limited liability company with its principal place of business in the State of Wyoming,
        operator of the NodalPulse software-as-a-service product (collectively,
        &ldquo;<strong>NodalPulse</strong>,&rdquo; &ldquo;<strong>we</strong>,&rdquo;
        &ldquo;<strong>us</strong>,&rdquo; or &ldquo;<strong>our</strong>&rdquo;).
        &ldquo;<strong>NodalPulse</strong>&rdquo; is a product and trade name of Cordillera
        Ventures LLC; the contracting legal entity in all cases is Cordillera Ventures LLC.
      </p>
      <p>
        By creating an account, accessing the website at <code>nodalpulse.com</code> and{" "}
        <code>app.nodalpulse.com</code> (collectively the &ldquo;<strong>Site</strong>&rdquo;), or
        using any feature of the Service (as defined below), you agree to be bound by these Terms
        and by our <a href="/privacy">Privacy Policy</a>, which is incorporated by reference. If
        you do not agree, do not create an account and do not use the Service.
      </p>
      <p>
        If you are accepting these Terms on behalf of a company, partnership, or other legal entity,
        you represent and warrant that you have the authority to bind that entity, and
        &ldquo;Customer&rdquo; refers to that entity.
      </p>

      {/* 2 */}
      <h2>2. The Service</h2>
      <p>
        NodalPulse provides a software-as-a-service application that monitors public regulatory
        filings and market notices from sources including (but not limited to) the Public Utility
        Commission of Texas (&ldquo;<strong>PUCT</strong>&rdquo;) Interchange Filing System and the
        Electric Reliability Council of Texas (&ldquo;<strong>ERCOT</strong>&rdquo;) Market
        Information System, and produces:
      </p>
      <ul>
        <li>
          <strong>Morning Briefs.</strong> AI-assisted summaries of filings that match
          Customer&rsquo;s stated role, markets, tracked dockets, and saved searches, delivered by
          email and accessible in the application dashboard.
        </li>
        <li>
          <strong>Saved Searches.</strong> Customer-defined queries that surface matching filings as
          they are ingested.
        </li>
        <li>
          <strong>Q&amp;A Chat.</strong> A conversational interface that answers Customer questions
          by retrieving and summarizing relevant filings (available on qualifying paid plans).
        </li>
        <li>
          <strong>Team and API access.</strong> Multi-seat collaboration and programmatic access
          (available on qualifying paid plans).
        </li>
      </ul>
      <p>
        We refer to all of the above, together with the Site and any related documentation, support,
        and updates, as the &ldquo;<strong>Service</strong>.&rdquo;
      </p>
      <p>
        The Service is provided as a hosted application. Customer does not receive a copy of the
        software and is not granted any license to install, modify, decompile, or redistribute the
        underlying code.
      </p>

      {/* 3 */}
      <h2>3. Eligibility and account registration</h2>

      <h3>3.1 Age and capacity</h3>
      <p>
        The Service is intended for use by businesses and by individuals acting in a commercial or
        professional capacity. By creating an account, you represent and warrant that you are at
        least 18 years old and have the legal capacity to enter into a binding contract.
      </p>

      <h3>3.2 Account information</h3>
      <p>
        You agree to provide accurate, current, and complete information when you create an account,
        and to update that information as it changes. You are responsible for safeguarding your
        credentials (including any OAuth-linked Google or Microsoft account used for sign-in) and
        for all activity that occurs under your account. You agree to notify us promptly at{" "}
        <code>support@nodalpulse.com</code> if you suspect unauthorized access.
      </p>

      <h3>3.3 One account per person</h3>
      <p>
        Each individual user must have their own account. Sharing a single account among multiple
        individuals violates these Terms and the per-seat pricing on which the Service is offered,
        and may result in suspension.
      </p>

      {/* 4 */}
      <h2>4. Subscription plans, billing, and trials</h2>

      <h3>4.1 Plans</h3>
      <p>
        The Service is offered in tiered subscription plans (currently: Starter, Pro, Team, and Org)
        with the features and entitlements described on <code>nodalpulse.com/pricing</code>. We may
        change the available plans, features, or pricing on notice. Existing paid subscriptions will
        not be repriced mid-period; price changes apply at the next renewal.
      </p>

      <h3>4.2 Free trial</h3>
      <p>
        We may offer a free trial of a paid plan for a defined trial period (currently 14 days). At
        the end of the trial period, the subscription will automatically convert to a paid
        subscription billed at the then-current rate for the plan you selected, unless you cancel
        before the end of the trial. We rely on this automatic conversion; please review your plan
        and billing cadence before the trial ends.
      </p>

      <h3>4.3 Payment processing</h3>
      <p>
        All payments are processed by Stripe, Inc. (&ldquo;<strong>Stripe</strong>&rdquo;). By
        providing payment information, you authorize us and Stripe to charge the payment method you
        provide for the subscription fees and any applicable taxes. We do not store full payment
        card numbers on our systems. Your relationship with Stripe is governed by Stripe&rsquo;s
        own terms; see our <a href="/privacy">Privacy Policy</a> for more on data sharing with
        Stripe.
      </p>

      <h3>4.4 Auto-renewal</h3>
      <p>
        Paid subscriptions renew automatically at the end of each billing period (monthly or annual,
        depending on the plan you select) until you cancel. You may cancel at any time through the
        Stripe Customer Portal linked from your account settings. Cancellation takes effect at the
        end of the current billing period.
      </p>

      <h3>4.5 No refunds</h3>
      <p>
        Except where required by applicable law, all fees are non-refundable. If you cancel, you
        retain access to the Service until the end of your current paid billing period, after which
        your account will be downgraded to whatever free or restricted access (if any) we then
        offer. We do not provide pro-rated refunds for partial periods of use.
      </p>

      <h3>4.6 Taxes</h3>
      <p>
        Stated fees do not include taxes. You are responsible for any sales, use, value-added,
        withholding, or other taxes that apply to your purchase, except for taxes on our net income.
      </p>

      <h3>4.7 Failed payment</h3>
      <p>
        If a payment fails, we may suspend or downgrade your access after reasonable notice. You
        remain liable for fees accrued before suspension.
      </p>

      {/* 5 */}
      <h2>5. Customer responsibilities and acceptable use</h2>

      <h3>5.1 Lawful use</h3>
      <p>
        You agree to use the Service only for lawful purposes and in compliance with these Terms,
        our <a href="/privacy">Privacy Policy</a>, and all applicable laws and regulations,
        including export controls, sanctions, and securities laws.
      </p>

      <h3>5.2 Prohibited conduct</h3>
      <p>You agree not to, and not to permit any third party to:</p>
      <p>
        (a) reverse engineer, decompile, disassemble, or attempt to derive the source code of the
        Service, except to the extent applicable law expressly prohibits this restriction;
      </p>
      <p>
        (b) scrape, crawl, or use automated means to access the Service other than via API endpoints
        we publish and explicitly permit, or use the Service in a manner that imposes an
        unreasonable load on our infrastructure;
      </p>
      <p>
        (c) resell, sublicense, or commercially redistribute the Service or its outputs (including
        Morning Briefs, Q&amp;A responses, or filings summaries) as a stand-alone product or as the
        substantial component of a competing product;
      </p>
      <p>
        (d) use the Service to build a competing product or to train a machine-learning model
        intended to replicate the Service&rsquo;s functionality;
      </p>
      <p>
        (e) remove, obscure, or alter any proprietary notices, attribution, or &ldquo;Generated by
        NodalPulse&rdquo; marks in outputs;
      </p>
      <p>
        (f) attempt to circumvent rate limits, entitlement gates, plan restrictions, or security
        features;
      </p>
      <p>
        (g) upload, transmit, or input content that infringes intellectual property rights, contains
        malicious code, violates privacy or publicity rights, or is otherwise unlawful;
      </p>
      <p>
        (h) use the Service in a manner intended to harass, defame, or impersonate any person or
        entity;
      </p>
      <p>
        (i) misrepresent your affiliation with any regulator, utility, market operator, or other
        public body.
      </p>

      <h3>5.3 Regulated-market activity</h3>
      <p>
        NodalPulse is an information-summarization product, not a regulatory advisor,
        broker-dealer, investment adviser, law firm, or commodity trading advisor. You are solely
        responsible for your own regulatory filings, compliance obligations, trading decisions, and
        any actions you take or do not take in reliance on the Service. See{" "}
        <strong>Section 7</strong> for important disclaimers about AI-generated content and{" "}
        <strong>Section 11</strong> for liability limitations.
      </p>

      <h3>5.4 Suspension for violation</h3>
      <p>
        We may suspend your account or specific features without prior notice if we reasonably
        believe you have violated this <strong>Section 5</strong>, if we are required to do so by
        law, or if continuing service creates a security, legal, or operational risk. Where
        practical, we will give you notice and an opportunity to cure.
      </p>

      {/* 6 */}
      <h2>6. Intellectual property</h2>

      <h3>6.1 Ownership of the Service</h3>
      <p>
        As between you and us, we own all right, title, and interest in and to the Service,
        including all software, designs, interfaces, models, prompts, and proprietary content, and
        all intellectual property rights therein. These Terms grant you only a limited,
        non-exclusive, non-transferable, revocable license to access and use the Service during your
        active subscription, solely for your internal business purposes.
      </p>

      <h3>6.2 Customer Data</h3>
      <p>
        &ldquo;<strong>Customer Data</strong>&rdquo; means any data, content, or information you
        submit to the Service, including your account profile, market roles, tracked dockets, saved
        searches, Q&amp;A questions, and uploaded documents (if any). As between you and us, you
        retain all right, title, and interest in Customer Data. You grant us a worldwide,
        non-exclusive, royalty-free license to host, store, transmit, process, and display Customer
        Data solely as necessary to provide the Service to you, to perform analytics on aggregated
        and de-identified data, to enforce these Terms, and to comply with law. We do not sell
        Customer Data.
      </p>

      <h3>6.3 Public-source content</h3>
      <p>
        Filings, dockets, and other content originating from PUCT, ERCOT, or other public sources
        are not owned by us. We make no claim of ownership over the underlying public records and do
        not warrant that our access to those sources will continue uninterrupted.
      </p>

      <h3>6.4 Outputs</h3>
      <p>
        &ldquo;<strong>Outputs</strong>&rdquo; means Morning Briefs, Q&amp;A responses, summaries,
        charts, and other AI-assisted content the Service generates for you. Subject to your
        compliance with these Terms and continued payment of fees, we grant you a worldwide,
        non-exclusive, royalty-free license to use Outputs for your internal business purposes,
        including reasonable internal redistribution within your organization.{" "}
        <strong>Section 5.2(c)</strong> restricts external commercial redistribution. Outputs are
        not original creative works of authorship and we make no representation that any Output
        qualifies for copyright or other intellectual property protection.
      </p>

      <h3>6.5 Feedback</h3>
      <p>
        If you provide us with suggestions, ideas, or feedback (&ldquo;<strong>Feedback</strong>
        &rdquo;), you grant us a perpetual, irrevocable, worldwide, royalty-free license to use the
        Feedback for any purpose, including improving the Service, without obligation or attribution
        to you.
      </p>

      {/* 7 */}
      <h2>7. AI-generated content; regulated-data indirection</h2>
      <p>
        <strong>
          This section is fundamental to your use of NodalPulse. Please read it carefully.
        </strong>
      </p>

      <h3>7.1 AI assistance</h3>
      <p>
        The Service uses large language models, including third-party models accessed via
        Anthropic&rsquo;s Claude API, to summarize filings, answer questions, and generate Morning
        Briefs. AI systems can and do produce errors, including:
      </p>
      <ul>
        <li>
          <strong>Hallucinations.</strong> Output that appears authoritative but is factually
          incorrect, including invented citations, docket numbers, party names, or filing summaries.
        </li>
        <li>
          <strong>Omissions.</strong> Failure to surface a relevant filing or to include a material
          detail.
        </li>
        <li>
          <strong>Stale information.</strong> Output that reflects a previous state of a docket
          because of ingestion lag or source-system outages.
        </li>
        <li>
          <strong>Mischaracterization.</strong> Output that correctly identifies a filing but
          mischaracterizes its substance or significance.
        </li>
      </ul>

      <h3>7.2 You must verify</h3>
      <p>
        You agree to independently verify any Output against the underlying source filing before
        relying on it for any decision that has financial, legal, regulatory, operational, or
        reputational consequences. We provide citations and links to source filings precisely so
        that verification is possible; using the Service without performing that verification is at
        your own risk.
      </p>

      <h3>7.3 Public-source indirection</h3>
      <p>
        NodalPulse summarizes and indexes public regulatory filings; it is <strong>not</strong> the
        official source of those filings. The official sources include the PUCT Interchange Filing
        System, the ERCOT Market Information System, and other public records systems. We do not
        warrant that our copy of any filing is complete, current, or identical to the official
        version. If accuracy or completeness matters for your decision, retrieve and review the
        official source.
      </p>

      <h3>7.4 No advice</h3>
      <p>
        Nothing in the Service constitutes legal advice, investment advice, trading advice,
        regulatory compliance advice, engineering judgment, or any other form of professional
        advice. The Service is an information-retrieval and summarization tool. You should consult
        qualified legal, regulatory, financial, or technical professionals for advice specific to
        your situation.
      </p>

      <h3>7.5 No trading reliance</h3>
      <p>
        The Service is not designed for, and you agree not to use the Service as, the sole or
        primary basis for any trading, bidding, scheduling, or position-taking decision in any
        electricity, capacity, ancillary services, congestion-revenue-rights, transmission-rights,
        or related market. You acknowledge that Outputs may be incomplete, delayed, or incorrect and
        that no representation is made that the Service will surface every event that matters to
        your position.
      </p>

      <h3>7.6 Service availability</h3>
      <p>
        We use commercially reasonable efforts to keep the Service available, but we do not warrant
        uninterrupted, error-free, or secure operation. The Service depends on third-party
        infrastructure (including Railway, Cloudflare, Stripe, and Anthropic) and on the
        availability of public-source systems (including PUCT IFS and ERCOT MIS); outages or rate
        limits in those systems will affect the Service. We do not offer a contractual uptime SLA at
        this time. <strong>Section 11</strong> addresses liability for downtime.
      </p>

      {/* 8 */}
      <h2>8. Third-party services and integrations</h2>
      <p>
        The Service relies on certain third-party services to function, including those listed in
        our <a href="/privacy">Privacy Policy</a>. Your use of the Service is conditioned on those
        third parties continuing to be available on commercially reasonable terms. We are not
        responsible for the acts, omissions, downtime, pricing changes, or terms of service of
        third parties.
      </p>
      <p>
        OAuth sign-in is provided through Google and Microsoft. Your use of those sign-in methods
        is also subject to the respective provider&rsquo;s terms; we receive only the information
        described in our <a href="/privacy">Privacy Policy</a>.
      </p>

      {/* 9 */}
      <h2>9. Term and termination</h2>

      <h3>9.1 Term</h3>
      <p>
        These Terms take effect when you first accept them and continue until your account is
        terminated.
      </p>

      <h3>9.2 Termination by you</h3>
      <p>
        You may terminate at any time by cancelling your subscription and deleting your account
        through your settings. Cancellation takes effect at the end of your current paid billing
        period.
      </p>

      <h3>9.3 Termination by us</h3>
      <p>We may suspend or terminate your account immediately and without liability if:</p>
      <p>
        (a) you materially breach these Terms (including any breach of <strong>Section 5</strong>)
        and, where practicable, fail to cure the breach within ten (10) days of our notice;
      </p>
      <p>
        (b) we reasonably believe your account is being used for fraudulent, illegal, or abusive
        activity;
      </p>
      <p>
        (c) we are required to do so by law or by a regulator, court, or financial partner;
      </p>
      <p>
        (d) we discontinue the Service in whole or in part, in which case we will use commercially
        reasonable efforts to give you at least thirty (30) days&rsquo; notice; or
      </p>
      <p>
        (e) your payment method fails and the issue is not cured within a reasonable period after
        notice.
      </p>

      <h3>9.4 Effect of termination</h3>
      <p>
        Upon termination, your right to access the Service ceases, and we may delete Customer Data
        in accordance with our <a href="/privacy">Privacy Policy</a> and our retention practices.
        Sections 5.2, 6, 7, 10, 11, 12, 13, 14, and 16 survive termination.
      </p>

      <h3>9.5 Data export</h3>
      <p>
        For a reasonable period before termination (and, where you initiate cancellation, also after
        the end of your paid period), you may export your account&rsquo;s structured data through
        features available in the application. We are not obligated to provide custom export formats
        or to retain Customer Data after the retention period stated in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      {/* 10 */}
      <h2>10. Disclaimers</h2>
      <p>
        EXCEPT AS EXPRESSLY STATED IN THESE TERMS, THE SERVICE AND ALL OUTPUTS ARE PROVIDED{" "}
        <strong>&ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;</strong> WITHOUT WARRANTY OF
        ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS,
        IMPLIED, AND STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, COMPLETENESS, AND QUIET ENJOYMENT.
      </p>
      <p>
        WITHOUT LIMITING THE FOREGOING, WE DO NOT WARRANT THAT (i) THE SERVICE WILL MEET YOUR
        REQUIREMENTS, (ii) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, (iii)
        OUTPUTS WILL BE ACCURATE, COMPLETE, OR RELIABLE, OR (iv) ANY DEFECTS WILL BE CORRECTED.
        SECTION 7 (AI-GENERATED CONTENT) APPLIES IN ADDITION TO THIS SECTION.
      </p>
      <p>
        Some jurisdictions do not allow the exclusion of implied warranties; in those jurisdictions,
        the exclusions above apply only to the extent permitted.
      </p>

      {/* 11 */}
      <h2>11. Limitation of liability</h2>

      <h3>11.1 Cap on liability</h3>
      <pre><code>{`IN NO EVENT SHALL NODALPULSE'S TOTAL AGGREGATE LIABILITY ARISING OUT OF
OR RELATING TO THESE TERMS OR THE SERVICE EXCEED THE GREATER OF:

   (a) ONE HUNDRED U.S. DOLLARS ($100), OR
   (b) THE AMOUNTS YOU ACTUALLY PAID TO NODALPULSE FOR THE SERVICE IN
       THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING
       RISE TO THE CLAIM.`}</code></pre>

      <h3>11.2 Excluded damages</h3>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF
        PROFITS, REVENUE, BUSINESS, GOODWILL, OR DATA, ARISING OUT OF OR RELATING TO THESE TERMS
        OR THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>

      <h3>11.3 Carveouts</h3>
      <p>
        The limitations in <strong>Sections 11.1 and 11.2</strong> do not apply to: (a) your
        payment obligations; (b) your obligations under <strong>Section 5.2</strong> (Prohibited
        conduct) and <strong>Section 5.3</strong> (Regulated-market activity); (c) either
        party&rsquo;s indemnification obligations under <strong>Section 12</strong>; (d) either
        party&rsquo;s breach of confidentiality; or (e) damages that cannot be limited or excluded
        under applicable law (such as a party&rsquo;s gross negligence, willful misconduct, or
        fraud).
      </p>

      <h3>11.4 Basis of the bargain</h3>
      <p>
        You acknowledge that the pricing of the Service reflects the allocation of risk in these
        Terms, that the limitations in this <strong>Section 11</strong> are an essential element of
        the bargain between you and us, and that we would not provide the Service without them.
      </p>

      {/* 12 */}
      <h2>12. Indemnification</h2>

      <h3>12.1 By you</h3>
      <p>
        You will defend, indemnify, and hold harmless NodalPulse, its officers, directors,
        employees, and agents from and against any third-party claims, damages, liabilities, costs,
        and expenses (including reasonable attorneys&rsquo; fees) arising out of or relating to:
      </p>
      <p>
        (a) your breach of <strong>Section 5</strong> (Customer responsibilities and acceptable
        use), including any use of the Service in a manner not permitted by these Terms;
      </p>
      <p>
        (b) your Customer Data, including any claim that your Customer Data infringes a third
        party&rsquo;s rights;
      </p>
      <p>
        (c) your reliance on Outputs for trading, regulatory, legal, or other decisions, including
        any claim brought by your customers, counterparties, employers, or regulators;
      </p>
      <p>(d) your violation of any law, including securities, energy, or privacy law.</p>

      <h3>12.2 By us</h3>
      <p>
        We will defend, indemnify, and hold harmless you from and against any third-party claim
        alleging that the Service, as delivered by us and used in accordance with these Terms,
        infringes a U.S. patent, registered U.S. copyright, or U.S. trademark of the claimant.
        This obligation does not apply to claims arising from: (i) Customer Data; (ii) modifications
        to the Service made by anyone other than us; (iii) combinations of the Service with
        hardware, software, or data not provided or recommended by us; or (iv) your use of the
        Service after we have notified you to stop.
      </p>

      <h3>12.3 Procedure</h3>
      <p>
        The indemnified party must promptly notify the indemnifying party of the claim, give the
        indemnifying party sole control of the defense and settlement (provided no settlement may
        admit liability of the indemnified party or impose any non-monetary obligation on the
        indemnified party without consent), and cooperate at the indemnifying party&rsquo;s
        expense.
      </p>

      <h3>12.4 Sole remedy</h3>
      <p>
        This <strong>Section 12</strong> states the parties&rsquo; sole and exclusive remedies and
        the indemnifying party&rsquo;s sole liability for third-party intellectual property claims.
      </p>

      {/* 13 */}
      <h2>13. Dispute resolution; mandatory arbitration; class action waiver</h2>
      <p>
        <strong>
          PLEASE READ THIS SECTION CAREFULLY. IT REQUIRES YOU TO RESOLVE DISPUTES WITH US BY
          BINDING INDIVIDUAL ARBITRATION AND LIMITS THE WAY YOU CAN SEEK RELIEF FROM US.
        </strong>
      </p>

      <h3>13.1 Informal resolution first</h3>
      <p>
        Before initiating any formal proceeding, the parties will attempt in good faith to resolve
        any dispute by negotiation. You may begin this process by sending a written notice
        describing the dispute and the relief you seek to <code>support@nodalpulse.com</code>. If
        the dispute is not resolved within thirty (30) days of that notice, either party may
        initiate arbitration.
      </p>

      <h3>13.2 Binding arbitration</h3>
      <p>
        Except as provided in <strong>Section 13.5</strong> (Carveouts) and{" "}
        <strong>Section 13.6</strong> (EU and UK users), any dispute arising out of or relating to
        these Terms or the Service will be resolved by binding, individual arbitration administered
        by JAMS in accordance with the JAMS Streamlined Arbitration Rules and Procedures then in
        effect. The arbitration will be conducted in English, by a single arbitrator, and seated in
        Cheyenne, Wyoming (with the option of telephonic or videoconference hearings to reduce
        cost). Judgment on the arbitration award may be entered in any court of competent
        jurisdiction.
      </p>

      <h3>13.3 Class action waiver</h3>
      <pre><code>{`YOU AND NODALPULSE EACH WAIVE THE RIGHT TO BRING OR PARTICIPATE IN ANY
CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION. ARBITRATION UNDER THIS
SECTION IS LIMITED TO INDIVIDUAL CLAIMS. THE ARBITRATOR HAS NO AUTHORITY
TO HEAR CLASS CLAIMS OR TO AWARD CLASS-WIDE RELIEF.`}</code></pre>
      <p>
        If a court determines that this class-action waiver is unenforceable as to any claim, that
        claim will be severed from arbitration and litigated in court under{" "}
        <strong>Section 14</strong>, but the remainder of this <strong>Section 13</strong> will
        remain in effect.
      </p>

      <h3>13.4 30-day opt-out</h3>
      <p>
        You may opt out of this arbitration and class-action waiver provision by sending written
        notice to <code>support@nodalpulse.com</code> within thirty (30) days of first accepting
        these Terms. Your notice must include your name, the email address associated with your
        account, and a clear statement that you opt out. Opting out does not affect any other
        provision of these Terms.
      </p>

      <h3>13.5 Carveouts</h3>
      <p>
        The following claims are <strong>not</strong> subject to arbitration and may be brought in
        court under <strong>Section 14</strong>: (a) claims for injunctive or other equitable
        relief (including temporary restraining orders) to protect a party&rsquo;s intellectual
        property, confidential information, or security; (b) claims of intellectual property
        infringement; and (c) claims that small-claims court of competent jurisdiction may hear, at
        the election of either party.
      </p>

      <h3>13.6 EU and UK users</h3>
      <p>
        If you are a consumer resident in the European Union or the United Kingdom, this{" "}
        <strong>Section 13</strong> does not deprive you of mandatory protections under the law of
        your country of residence. You may bring proceedings in the courts of your country of
        residence, and we may bring proceedings only in the courts of your country of residence in
        any consumer dispute.
      </p>

      {/* 14 */}
      <h2>14. Governing law; venue for non-arbitrable claims</h2>
      <p>
        These Terms are governed by the laws of the State of Wyoming, without regard to its
        conflicts-of-law principles, and excluding the United Nations Convention on Contracts for
        the International Sale of Goods. For any claim not subject to arbitration under{" "}
        <strong>Section 13</strong>, the parties consent to the exclusive jurisdiction and venue of
        the state and federal courts located in Laramie County, Wyoming, and waive any objection
        to inconvenient forum.
      </p>

      {/* 15 */}
      <h2>15. Changes to these Terms</h2>
      <p>
        We may modify these Terms from time to time. If we make material changes, we will give you
        reasonable notice (for example, by posting a notice on the Site or by email to the address
        on your account) at least fifteen (15) days before the change takes effect, except where a
        shorter period is required by law. Your continued use of the Service after the effective
        date constitutes acceptance of the changes. If you do not agree, your sole remedy is to
        stop using the Service and cancel your subscription before the change takes effect.
      </p>

      {/* 16 */}
      <h2>16. Miscellaneous</h2>

      <h3>16.1 Entire agreement</h3>
      <p>
        These Terms, together with the <a href="/privacy">Privacy Policy</a> and any order form or
        supplemental written agreement we sign with you, constitute the entire agreement between the
        parties regarding the Service and supersede all prior or contemporaneous understandings.
      </p>

      <h3>16.2 No waiver</h3>
      <p>Our failure to enforce any provision is not a waiver of our right to do so later.</p>

      <h3>16.3 Severability</h3>
      <p>
        If any provision is held unenforceable, the remaining provisions will remain in full force,
        and the unenforceable provision will be reformed only to the extent necessary to make it
        enforceable, preserving the parties&rsquo; original intent as closely as possible.
      </p>

      <h3>16.4 Assignment</h3>
      <p>
        You may not assign these Terms or any rights or obligations under them without our prior
        written consent. Any attempt to do so is void. We may assign these Terms in connection with
        a merger, acquisition, sale of assets, financing, or change of control on notice to you.
      </p>

      <h3>16.5 No agency</h3>
      <p>
        Nothing in these Terms creates a partnership, joint venture, agency, or employment
        relationship between the parties. Neither party has authority to bind the other.
      </p>

      <h3>16.6 Force majeure</h3>
      <p>
        Neither party is liable for any failure or delay in performance (other than payment
        obligations) caused by events beyond reasonable control, including acts of God, war,
        terrorism, civil unrest, governmental action, labor disputes, internet or utility outages,
        denial-of-service attacks, pandemic, or failure of upstream providers (including PUCT,
        ERCOT, Anthropic, Stripe, Cloudflare, or Railway).
      </p>

      <h3>16.7 Notices</h3>
      <p>
        We may send notices to the email address on your account. You must send legal notices to{" "}
        <code>support@nodalpulse.com</code> with &ldquo;Legal Notice&rdquo; in the subject line.
        Notices are effective on the day delivered, if delivered during business hours on a business
        day in Wyoming, and otherwise on the next business day.
      </p>

      <h3>16.8 Government users</h3>
      <p>
        If you are a U.S. federal, state, or local government entity, you acknowledge that the
        Service is &ldquo;commercial computer software&rdquo; under FAR 12.212 and DFARS 227.7202
        and is licensed to you on the same commercial terms set out in these Terms.
      </p>

      <h3>16.9 Export control</h3>
      <p>
        You will comply with all applicable U.S. and foreign export and re-export control laws and
        regulations and will not use the Service in any jurisdiction subject to comprehensive U.S.
        sanctions.
      </p>

      <h3>16.10 Headings</h3>
      <p>Section headings are for convenience and do not affect interpretation.</p>

      {/* 17 */}
      <h2>17. How to contact us</h2>
      <p>If you have any questions about these Terms, write to:</p>
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
    </LegalShell>
  )
}
