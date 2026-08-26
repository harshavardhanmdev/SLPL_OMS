export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";

import { getGrievanceOfficer, ACK_SLA_HOURS, RESOLUTION_SLA_DAYS } from "@/lib/grievances";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Grievance Redressal",
  description:
    "How to raise a complaint with SLPL Store, our named Grievance Officer, response timelines and how to escalate a payment dispute.",
};

export default async function GrievancePolicyPage() {
  const officer = await getGrievanceOfficer();

  return (
    <>
      <h1>Grievance Redressal Policy</h1>
      <p>
        Last updated: 26 August 2026. This policy applies to {site.name} (store.theslpl.in), operated
        by {site.company}, and is published in line with the Consumer Protection (E-Commerce) Rules,
        2020 and the grievance redressal requirements applicable to online payments in India.
      </p>

      <h2>How to raise a complaint</h2>
      <p>
        The fastest route is our{" "}
        <Link href="/grievance">online complaint form</Link>. You do not need an account. You will
        receive a ticket number immediately and a private link to follow progress and reply to us.
        You can also write to {officer.email} or call {officer.phone}, quoting your order number if
        you have one.
      </p>
      <p>
        For a payment problem, please include the amount debited, the date and time, and the
        transaction or UPI reference from your bank statement. That single detail is usually what
        lets us trace a payment with the bank in hours rather than days.
      </p>

      <h2>Grievance Officer</h2>
      <p>
        In accordance with the Consumer Protection (E-Commerce) Rules, 2020, the following officer is
        responsible for complaint redressal:
      </p>
      <ul>
        <li>
          <b>Name:</b> {officer.name}
        </li>
        <li>
          <b>Designation:</b> Grievance Officer, {site.company}
        </li>
        <li>
          <b>Email:</b> {officer.email}
        </li>
        <li>
          <b>Phone:</b> {officer.phone} (Monday to Saturday, 9:30 am to 6:30 pm IST)
        </li>
        <li>
          <b>Address:</b> {site.contact.address}
        </li>
      </ul>

      <h2>Our response timelines</h2>
      <ul>
        <li>
          Every complaint is acknowledged within <b>{ACK_SLA_HOURS} hours</b> of being received.
        </li>
        <li>
          Every complaint is resolved within <b>{RESOLUTION_SLA_DAYS} days</b> of being received.
          Most are settled far sooner.
        </li>
        <li>
          Complaints involving money already debited are treated as priority and looked at the same
          working day wherever possible.
        </li>
        <li>
          If we need something from you to proceed, we will say so on your ticket, and the clock on
          our side keeps running.
        </li>
      </ul>

      <h2>Escalation</h2>
      <p>If you are not satisfied, you can escalate. Each level has a published route:</p>
      <ul>
        <li>
          <b>Level 1, customer support:</b> the complaint form above, {site.contact.email} or{" "}
          {site.contact.phone}. Response within 1 working day.
        </li>
        <li>
          <b>Level 2, Grievance Officer:</b> {officer.name} at {officer.email}. Use this if Level 1
          has not resolved matters or has not replied in time. Acknowledged within {ACK_SLA_HOURS}{" "}
          hours, resolved within {RESOLUTION_SLA_DAYS} days.
        </li>
        <li>
          <b>Level 3, external:</b> for payment disputes, our payment aggregator is{" "}
          <b>Razorpay Software Private Limited</b>, whose own grievance redressal channel and nodal
          officer details are published at{" "}
          <a href="https://razorpay.com/support/" target="_blank" rel="noreferrer">
            razorpay.com/support
          </a>
          . If a digital payment complaint remains unresolved for more than 30 days, you may approach
          the <b>RBI Ombudsman for Digital Transactions</b> through the Reserve Bank of India&apos;s
          complaint portal at{" "}
          <a href="https://cms.rbi.org.in" target="_blank" rel="noreferrer">
            cms.rbi.org.in
          </a>
          . Consumer complaints may also be filed with the National Consumer Helpline (1915) or at{" "}
          <a href="https://consumerhelpline.gov.in" target="_blank" rel="noreferrer">
            consumerhelpline.gov.in
          </a>
          .
        </li>
      </ul>

      <h2>Refunds arising from a complaint</h2>
      <p>
        Where a complaint results in a refund, the timelines in our{" "}
        <Link href="/policies/refund">Cancellation and Refund Policy</Link> apply: prepaid orders are
        refunded to the original payment method within 5 to 7 working days of approval through
        Razorpay, and Cash on Delivery orders by bank transfer within 7 working days. Payments
        debited without an order confirmation are reversed automatically, typically within 5 to 7
        working days.
      </p>

      <h2>What we record</h2>
      <p>
        We keep a record of every complaint, its ticket number, the correspondence on it and its
        outcome, so that any escalation can be reviewed against a complete history. Personal details
        are handled as set out in our <Link href="/policies/privacy">Privacy Policy</Link> and used
        only to investigate and resolve your complaint.
      </p>

      <h2>Contact</h2>
      <p>
        {site.company}, {site.contact.address}. Phone: {site.contact.phone}. Email:{" "}
        {site.contact.email}.
      </p>
    </>
  );
}
