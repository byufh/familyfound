#lang css

; list of rules
`((((div.person > a) a)
   (color green)
   (cursor pointer)
   (background-color ,dark-red)
   ((span.name span.size)
    (color red)
    (font-size 20px))))

(define dark-red '#400)

(define vbls 
  '((base-font-size 5)
    (dark-red #400)

`((<person-a>
    (div.person > a) (a) (span.person a)
    ((color green)
     (cursor pointer)
     (background-color ,dark-red)
     (font-size ,(+ base-font-size 5)px)
     (span (: a (href man*) :hover)
           (


(rule `((div.person > a) a)
      `((color green)
        (cursor pointer)
        (background-color ,darkest))
      (rule `(span.name)
            `((font-size 32px)
              (border-radius 2px 5px
                             ,(+ normal-radius 15)))
        ))


