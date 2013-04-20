
Parents Ideas:
  - I want to take notes!
    - attach them to people
    - also general
    - list your notes by last edited
  - "The trail"
    - track your history
    - you added this note
    - you confirmed this one thing

Selina:
  - time slider button - display current year
  - don't move unless pushed
  - breadcrumb -> relatedness

  - follow one person's line. visually, map
    - also, label with names and things
    - also show their spouses
    - color:
      - male / female?
      - married / single?

What Works:

- list view

  - sorting:

    - generation
    - birth year
    - last name
    - first name


Close:

- list view

  - side view thing

  - filtering

    - all
    - missing info
    - missing relationships

Future:

- list view:

  - it really should be a table.
  - add links 



Todo
----

Person splitting:
- have a graphically intuitive way of splitting a falsely combined persona
  into it's component parts.


Alert for duplicate spouses: [especially if the spouses have the same name]
- in the full person read, persons->person->families->
   if there are multiple families, they have more than one recorded spouse. So
   check to see if the names are similar -- if so, suggest strongly that they
   be combined. Otherwise, show an alert...

* App Pages

v0.1

- map
- about

v0.2 - try to get it approved!

- oauth
- todo : a listing of missing info, etc.
  - links to sites where you can research

v0.3 - adding cool stuff

- tree
- history - a list of the people you've worked with
  - that will get persisted to there
- help
- feedback

* Network plan

- /check-login
  - if they're already logged in, then return personal info (name, etc.)
  - otherwise, return the "authorize_url" to show th iframe
    - then when the iframe redirects to the authorize page, it closes itself

- /get-pedigree
  - reaches back 9 generations, showing a loading indicator and a status text
    which shows how many ancestors have been loaded ... and maybe like when an
    installed is copying files ... so underneath the indicator would be the
    list of names that have been loaded.

- / ?? is there anything else I need?

- /logout ; clears the session

