import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Server-side fetch to Make.com (No CORS or Adblocker restrictions!)
    const response = await fetch("https://hook.eu1.make.com/ulzm6qrcq9r0537lbt8teadz1tys6vx1", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Make.com webhook failed" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}