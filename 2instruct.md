# PULSE-RTIP — Outstanding Requirements (from owner)

Translated from the original Tagalog instruction list. Numbering preserves
the original so cross-referencing with prior notes stays stable. Admin
items 1–3 were missing from the original file — flagged below.

---

## USER SIDE

1. **About Us** — show the researchers' (thesis authors') names in the profile
   section.

2. **Timezone** — surface / configure the correct timezone.

3. The **reason** for a user's post should be visible in the post-details view.

4. Place **community posts on the dashboard** (like a newsfeed) so the user
   doesn't have to scroll further to see them. Each post should be **clickable**
   and display author, timestamp, and location.

5. Users should be able to attach a **picture or video** to a community post.
   Each post should display **date, time, location, and author**.

6. Posts should be **editable**. The **original post plus the edit timestamps**
   must remain viewable (edit history).

7. **SMS alert when there's a flood.** Push notification must fire **even if
   the user isn't logged in**. SMS must reach everyone **even when the app is
   offline**.

8. **Audience-scoped alerts.** Example: if only one barangay has a fire, the
   notification can be sent only to that barangay, or to everyone. This should
   be a **category / audience selector**, similar to Facebook's "Only me /
   Friends / Everyone" post audience.

9. **Repost (share) button** for community posts.

10. In registration, **new sign-ups should default to "user" (citizen)**.
    Remove the "Select your role" step and go directly to ID verification.

11. **SMS alerts must still reach users without internet** (offline SMS
    broadcast channel).

12. Add a **back button at the top** (just an ← arrow). Bug example: when
    editing personal information, pressing the phone's back button currently
    closes the app entirely instead of going back to the previous screen.

13. **Dark mode bug** — the buttons are light-colored in dark mode, which makes
    the text hard to read (hurts the eyes).

14. The **app icon** needs work (update / replace it).

15. In the **Emergency section**, the call button says **"Slide to call"** (for
    emergencies call 911), but it isn't actually slideable — it only responds
    to a tap.

16. **Indicate carrier / number type** — show whether a phone number is TM,
    Smart, or a landline (telephone number).

---

## ADMIN SIDE

*(Items 1–3 missing from the original file — confirm whether they exist
elsewhere before the audit.)*

4. **Send announcements** for disasters (typhoon, earthquake, flooding) and
   system updates. These notifications must have a **sound alert**.

5. **Push notifications** to all users, or only to selected areas (audience
   selector — matches User-Side #8).

6. Make the **admin login a web-style UI** (desktop layout).

7. Bug: **"Report Progress" shows 0 pending** even when there are many pending
   reports. Fix.

8. On reports, track the **processing history** — who responded (rescue /
   investigator), when, and what actions were taken to resolve the incident.

9. Admins should be **issued their own email by the developer** directly — no
   self-registration of admin accounts.

10. **Revise the Preferences screen on the admin side.** It is currently
    identical to the user side, and several items don't apply to admins.

11. **Reports & Analytics (admin side):**
    - Total incidents per day / week / month
    - Most common emergency types
    - Response-time performance
    - Location-based incident breakdown

12. **Admin activity logs** — who responded, what, when, where.

13. **Incident modification history** (for accountability). Example: if Admin 1
    updates a report, and later Admin 2 updates the status, the record must
    show which admin made each change.

14. From the **Reports dashboard**, admins should be able to **promote a report
    to a community post**, including its progress.



2nd batch of fixing:

USER SIDE
1. hindi maka edit ng post
2. hindi nag ddisplay yung picture sa post & report pag nag lalagay (color gray lang)
3. yung create post button po sa community baka pwede pakilipat nalang po sa taas para mas mabilis makita ng user/admin
4. yung UI po sa news and updates hindi fit sa mobile, same problem din pag nirerepost yung post nasisiksik yung mga text sa gilid, lumalagpas yung repost/share buttons.
5. yung notification sound wala pa rin po pag nag a-add sa hazards and sa report hindi rin nag nonotif mismo sa phone pag naupdate yung status ng report (sa mismong app lang sya nag nonotif)
6. sa report hindi nalolocate mismo yung location kung nasan si user kahit nasan puro morong, rizal lang yung lumalabas.
7. sa 2nd time na open ng app naka white screen lang, need pa iclear data or reinstall para mag load ulit

ADMIN SIDE
1. hindi naddisplay yung mga picture/video na inupload ni user sa report and di rin sya lumalabas pag pinindot yung details
2. hindi nakakapag input ng details yung admin sa report ng user pag naresolve na (para syang comment na pwede ilagay kung sino mga nag resolve nung incident, pano naresolve and makikita yon mismo ng user once na ma-update na ni admin na resolved na yung report)
3. palagay rin po nung community post sa home
4. yung UI po sa news and updates hindi fit sa mobile, same problem din pag nirerepost yung post nasisiksik yung mga text sa gilid and lumalagpas yung mga button, palipat din po nung create post button sa taas.
5. yung pending and investigating sa report progress hindi pa rin naccount.
6. pag ni-click yung post walang lumalabas.

3rd batch:

User

1.SMS number for forgot pass and creating account walang lumalabas 
2.Yung pending hindi pa din nag appear sa screen ni user 
3.Kapag kiniclick yung post ni user walang lumalabas 
4.Kapag nirepost yung post sa view community post lumalaki yung space niya, hindi siya fit sa mobile app 
5.Dapat mag ppop or mag nonotif once na nag warning or nag post si admin or user ng incident sa view community post or kahit sa hazard 
6.Yung create post button sa sa view community post palagay sa taas po
7.sa report hindi pa din nalolocate yung mismo yung location kun nasan si user kahit nasa morong, rizal pa din lumalabas
8.Hindi na eedit yung post 
9.hindi pa din naddisplay

Admin
1. May dalawang pending na nasa in progress 
2. Yung tatlo na nasa investigating is hindi totally investigating(2 pending and 1 in
progress) 
3. Hindi nag aapper yung picture sa nung report sa My reports pero kapag clinick yung details ok naman yung picture 
4. Sa processing history pakilagay if si Admin 1 or Admin 2 yung nag ayos ng incident 
5. Don sa dashboard once na icclick yung resolved sa report paki add po sa Resolution Note yung oras ng pag rescue and etc, Name nung nag respond na Admin po
6. Once na maresolved na yung report and na promote siya sa community post yung mismong incident report na yun is mapupunta na don(para mabawasan yung incident reports sa Dashboards and My Reports since padami nang padami yung reports)
7. Also pwedeng palagyan na lang nung mga post sa community post ng mga picture(hinahanapan kasi ng mga panel, kahit ai generated na lang basta connected don sa incident kuya)
8. Pakitanggal na yung stat grid sa baba ng home ng admin kuya
9. Doon sa active hazard alert kuya, once na mag send sa mga citizen yung warning/alert direct na siyang mapupunta sa SMS sa dashboard para hindi napupuno yung warning message sa home ni admin

4th batch:

1. add delete button sa community post
2. paki remove yung video sa category sa community post
3. push notifications/sms
4. yung number sa slide to call pakipalitan ng 911
5. walang lumalabas pag kini-click or edit yung post sa community post (mobile app)
6. nakasiksik pa rin yung mga text sa gilid pag nag repost (mobile app)
7. hindi nag nnotif sa mismong phone pag naupdate yung status ng report

5th batch:

Admin
1. Kuya pwedeng palagyan ng delete button yung mga na resolved ng incident
2. Pwede pong palagyan ng delete button din yung Active Hazard Zones sa dashboard and once na madelete po yung specific na hazard alert na yon madedelete din siya sa Active Hazard Zone ni user sa home(mababawasan yung list)

User
1. Lagyan ng picture yung mga post sa community post 
2. Yung logo and need din po mabago yung logo kapag inopen yung app black po kasi lumalabas 
3. Push notification wala pa din daw po
4. Yung sms kapag gagawa account or forgot password walang lumalabas
5. May anim na pending sa notification pero 1 lang ang nasa stat grid sa baba ng home

6th batch

Admin
1. Kuya pwedeng palagyan ng delete button yung mga na resolved ng incident
2. Pwede pong palagyan ng delete button din yung Active Hazard Zones sa dashboard and once na madelete po yung specific na hazard alert na yon madedelete din siya sa Active Hazard Zone ni user sa home(mababawasan yung list)
note: implement the deletion with a bin function

User
1. Lagyan ng picture yung mga post sa community post 
2. Yung logo and need din po mabago yung logo kapag inopen yung app black po kasi lumalabas 
3. Push notification wala pa din daw po
4. Yung sms kapag gagawa account or forgot password walang lumalabas
5. May anim na pending sa notification pero 1 lang ang nasa stat grid sa baba ng home
6. padelete na din nung stat grid sa user sa home sa baba since ayaw niya macount nung pending sa notification eh